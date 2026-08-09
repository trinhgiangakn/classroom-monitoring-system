const path = require('path');
const express = require('express');
const cors = require('cors');

require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const database = require('./config/db');
const authRoutes = require('./routes/auth');
const auditRoutes = require('./routes/audit');
const userRoutes = require('./routes/users');
const { verifyToken } = require('./middleware/authMiddleware');
const { auditLogger } = require('./middleware/auditMiddleware');
const { attachMqttIngestion, createMqttClient } = require('./config/mqtt');

async function createApp({
    mqttClient = null,
    publishWebSocket = async () => {},
    logger = console,
} = {}) {
    const app = express();

    app.use(cors({
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    }));
    app.use(express.json({ limit: '1mb' }));

    app.get('/api/health', (req, res) => {
        res.status(200).json({
            success: true,
            service: 'classroom-monitoring-backend',
            mqtt_connected: Boolean(mqttClient?.connected),
        });
    });

    app.use('/api/auth', authRoutes);
    app.use('/api/audit-logs', auditRoutes);
    app.use('/api/users', userRoutes);

    const { createDev2Module, toErrorResponse } = await import('./src/dev2/index.js');
    const dev2 = createDev2Module({
        database,
        Router: express.Router,
        authenticate: verifyToken,
        afterAuthenticate: auditLogger,
        mqttClient,
        publishWebSocket,
        logger,
    });

    app.use('/api', dev2.router);

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

async function startServer(options = {}) {
    await database.testConnection();
    const logger = options.logger || console;
    const mqttClient = Object.prototype.hasOwnProperty.call(options, 'mqttClient')
        ? options.mqttClient
        : createMqttClient({ logger });
    const { app, dev2 } = await createApp({ ...options, logger, mqttClient });
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port, () => {
        console.log(`Backend server is running at: http://localhost:${port}`);
    });

    if (process.env.ENABLE_DEV2_JOBS !== 'false') {
        dev2.jobs.start();
    }
    const stopMqtt = attachMqttIngestion({ client: mqttClient, ingestion: dev2.mqtt, logger });

    const stop = async () => {
        await stopMqtt();
        dev2.jobs.stop();
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        await database.end();
    };

    return { app, server, dev2, stop };
}

if (require.main === module) {
    startServer()
        .then(runtime => {
            let stopping = false;
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
