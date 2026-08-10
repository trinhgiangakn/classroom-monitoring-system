const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const deviceRoutes = require('./src/routes/deviceRoutes');
const mqttService = require('./src/services/mqttService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io instance for local testing
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
});

// Bind WebSocket instance to Express app for global availability
app.set('io', io);

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve static HTML files from public folder for WebSocket testing
app.use(express.static(path.join(__dirname, 'public')));

// Register DEV 3 API Routes
app.use('/api', deviceRoutes);

// Initialize MQTT Service connection
mqttService.initMQTT(app);

// Root health-check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Local DEV 3 Server is running' });
});

// WebSocket Connection Logging & Room Joining
io.on('connection', (socket) => {
    console.log(`⚡ [WEBSOCKET] Client connected: ${socket.id}`);
    
    // Auto-join room P.101 for room monitoring
    socket.join('P.101');
    console.log(`[WEBSOCKET] Client ${socket.id} joined room: P.101`);

    socket.on('disconnect', () => {
        console.log(`[WEBSOCKET] Client disconnected: ${socket.id}`);
    });
});

// Start Local Test Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`DEV 3 Local Server listening on http://localhost:${PORT}`);
});