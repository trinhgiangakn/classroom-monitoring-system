/**
 * @fileoverview Main backend application entry point.
 * Integrates Express API routes, Socket.io WebSocket handling, MQTT telemetry/control services,
 * and modular application components across Dev 1, Dev 2, and Dev 3 layers.
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Load environment configuration from root directory quietly
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Database & Core Route Modules
const database = require('./config/db');
const authRoutes = require('./routes/auth');
const auditRoutes = require('./routes/audit');
const userRoutes = require('./routes/users');
const deviceRoutes = require('./src/routes/deviceRoutes');

// Middleware & Service Modules
const { verifyToken } = require('./middleware/authMiddleware');
const { auditLogger } = require('./middleware/auditMiddleware');
const { attachMqttIngestion, createMqttClient } = require('./config/mqtt');
const mqttService = require('./src/services/mqttService');
const { createRealtimePublisher } = require('./src/modules/realtime/realtime.publisher');
const deviceService = require('./src/services/deviceService');
const { DeviceCommandService } = require('./src/services/deviceCommandService');
const { AlertService } = require('./src/modules/alerts/alert.service');
const { MySqlAlertRepository } = require('./src/modules/alerts/mysql-alert.repository');
const { AutomationService } = require('./src/modules/automation/automation.service');
const { AutomationRuntime } = require('./src/modules/automation/automation-runtime');
const { MySqlAutomationRepository } = require('./src/modules/automation/mysql-automation.repository');
const { createWeatherRouter } = require('./src/modules/weather/weather.routes');
const { OpenMeteoProvider } = require('./src/modules/weather/open-meteo.provider');
const { MySqlWeatherRepository } = require('./src/modules/weather/mysql-weather.repository');
const { WeatherContextService } = require('./src/modules/weather/weather-context.service');
const { WeatherSyncJob } = require('./src/modules/weather/weather-sync.job');
const { REALTIME_EVENT } = require('./src/modules/realtime/realtime.events');

/**
 * Configures and instantiates the Express application.
 * @param {Object} options - Initialization options.
 * @param {Object|null} [options.mqttClient=null] - Pre-configured MQTT client instance.
 * @param {Function} [options.publishWebSocket=async () => {}] - WebSocket publishing handler.
 * @param {Object} [options.logger=console] - Application logger.
 * @returns {Promise<{app: Express.Application, dev2: Object}>} Configured Express app and Dev 2 module instance.
 */
async function createApp({
    mqttClient = null,
    publishWebSocket = async () => {},
    onTelemetryPersisted = async () => {},
    onNodeStatusesChanged = async () => {},
    weatherContext = null,
    logger = console,
} = {}) {
    const app = express();

    // Configure CORS policy for frontend client access (supports Vercel, localhost, and custom domains)
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (origin.endsWith('.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
                return callback(null, true);
            }
            if (process.env.FRONTEND_URL && (process.env.FRONTEND_URL === '*' || process.env.FRONTEND_URL.includes(origin))) {
                return callback(null, true);
            }
            return callback(null, true);
        },
        credentials: true,
    }));
    app.use(express.json({ limit: '1mb' }));

    // Serve static files for Dev 3 local UI testing
    app.use(express.static(path.join(__dirname, 'public')));

    // Service health check endpoint
    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            service: 'classroom-monitoring-backend',
            mqtt_connected: Boolean(mqttClient?.connected),
        });
    });

    // Register core system authentication, audit, and user management routes
    app.use('/api/auth', authRoutes);
    app.use('/api/audit-logs', auditRoutes);
    app.use('/api/users', userRoutes);

    // Register Dev 3 device control API routes
    app.use('/api', deviceRoutes);

    if (weatherContext) {
        app.use('/api', createWeatherRouter({
            Router: express.Router,
            authenticate: verifyToken,
            afterAuthenticate: auditLogger,
            weatherContext,
        }));
    }

    // Dynamic import and initialization of Dev 2 telemetry and analytics module
    const { createDev2Module, toErrorResponse } = await import('./src/dev2/index.js');
    const dev2 = createDev2Module({
        database,
        Router: express.Router,
        authenticate: verifyToken,
        afterAuthenticate: auditLogger,
        mqttClient,
        publishWebSocket,
        onTelemetryPersisted,
        onNodeStatusesChanged,
        logger,
    });

    app.use('/api', dev2.router);

    // Centralized API error handling middleware
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        const result = toErrorResponse(error);
        if (result.status >= 500) {
            logger.error?.('Unhandled API error', { message: error.message });
        }
        return res.status(result.status).json(result.body);
    });

    return { app, dev2 };
}

/**
 * Initializes database connections, HTTP/WebSocket servers, MQTT services, and scheduled jobs.
 * @param {Object} [options={}] - Server startup override parameters.
 * @returns {Promise<{app: Express.Application, server: http.Server, dev2: Object, stop: Function}>} Server runtime objects.
 */
async function startServer(options = {}) {
    await database.testConnection();
    const logger = options.logger || console;
    const mqttClient = Object.prototype.hasOwnProperty.call(options, 'mqttClient')
        ? options.mqttClient
        : createMqttClient({ logger });
    const weatherContext = options.weatherContext || new WeatherContextService({
        provider: options.weatherProvider || new OpenMeteoProvider(),
        repository: options.weatherRepository || new MySqlWeatherRepository(database),
    });

    // DEV 2 receives this adapter before Socket.io exists. It becomes active as
    // soon as the single Socket.io instance below has been created.
    let realtime = null;
    let automationRuntime = null;
    const publishWebSocket = options.publishWebSocket || (async (event, data) => {
        if (!realtime) return undefined;
        const roomId = data?.room_id || data?.roomId || 'P.101';
        return realtime.publishToRoom(roomId, { event, data });
    });

    const { app, dev2 } = await createApp({
        ...options,
        logger,
        mqttClient,
        weatherContext,
        publishWebSocket,
        onTelemetryPersisted: async (input) => automationRuntime?.handleTelemetry(input),
        onNodeStatusesChanged: async (input) => automationRuntime?.handleNodeStatuses(input),
    });

    // Wrap Express application with HTTP server to attach Socket.io (Dev 3)
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
    });

    app.set('io', io);
    realtime = createRealtimePublisher(io);
    app.set('realtime', realtime);
    app.set('weatherContext', weatherContext);
    const weatherJob = options.weatherJob || new WeatherSyncJob({
        weatherContext,
        logger,
        publish: async (snapshot) => realtime.publishToRoom(snapshot.roomId, {
            event: REALTIME_EVENT.WEATHER_UPDATE,
            data: snapshot,
        }),
    });
    app.set('weatherJob', weatherJob);
    const deviceCommandService = new DeviceCommandService({
        app,
        devices: deviceService,
        publishCommand: mqttService.publishCommand,
        logger,
    });
    app.set('deviceCommandService', deviceCommandService);

    const alertService = new AlertService(new MySqlAlertRepository(database));
    const automationService = new AutomationService({
        alerts: alertService,
        realtime,
        deviceCommands: deviceCommandService,
    });
    automationRuntime = new AutomationRuntime({
        automationService,
        repository: new MySqlAutomationRepository(database),
        weatherContext,
        logger,
    });
    app.set('automationService', automationService);
    app.set('automationRuntime', automationRuntime);

    // Manage WebSocket connections and room subscriptions
    io.on('connection', (socket) => {
        console.log(`[WEBSOCKET] Client connected: ${socket.id}`);
        socket.join('P.101');
        console.log(`[WEBSOCKET] Client ${socket.id} joined room: P.101`);

        socket.on('disconnect', () => {
            console.log(`[WEBSOCKET] Client disconnected: ${socket.id}`);
        });
    });

    // DEV 2 and DEV 3 share this one MQTT connection. DEV 3 only registers
    // command/ACK handlers; it must not create a second broker connection.
    const stopDeviceMqtt = mqttService.initMQTT({ app, mqttClient, logger });

    const port = Number(process.env.PORT || 3000);
    server.listen(port, () => {
        console.log(`Backend server is running at: http://localhost:${port}`);
        weatherJob.start();
    });

    // Start background cron jobs if enabled in environment
    if (process.env.ENABLE_DEV2_JOBS !== 'false') {
        dev2.jobs.start();
    }

    const stopMqtt = attachMqttIngestion({ client: mqttClient, ingestion: dev2.mqtt, logger });

    /**
     * Gracefully shuts down all active background jobs, servers, and database connections.
     */
    const stop = async () => {
        stopDeviceMqtt();
        await stopMqtt();
        dev2.jobs.stop();
        weatherJob.stop();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await database.end();
    };

    return { app, server, dev2, stop };
}

// Entry point execution when script is invoked directly via CLI
if (require.main === module) {
    startServer()
        .then(runtime => {
            let stopping = false;

            /**
             * Handles process termination signals for graceful shutdown.
             * @param {string} signal - The process signal received (e.g., SIGINT, SIGTERM).
             */
            const shutdown = async signal => {
                if (stopping) return;
                stopping = true;
                console.log(`Received ${signal}; shutting down.`);
                try {
                    await runtime.stop();
                    process.exitCode = 0;
                } catch (error) {
                    console.error('Backend shutdown failed:', error.message);
                    process.exitCode = 1;
                }
            };
            process.once('SIGINT', () => void shutdown('SIGINT'));
            process.once('SIGTERM', () => void shutdown('SIGTERM'));
        })
        .catch(error => {
            console.error('Backend startup failed:', error.message);
            process.exitCode = 1;
        });
}

module.exports = { createApp, startServer };
