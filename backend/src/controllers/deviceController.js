const deviceService = require('../services/deviceService');

// In-memory store for pending command timers (5-second ACK timeout tracking)
const pendingTimers = new Map();

/**
 * GET /api/devices
 * Retrieve the list of all registered devices.
 */
async function getDevices(req, res) {
    try {
        const devices = await deviceService.getAllDevices();
        return res.status(200).json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('Error in getDevices:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * GET /api/devices/:id
 * Retrieve details for a single device by its ID.
 */
async function getDeviceById(req, res) {
    try {
        const deviceId = req.params.id;
        const device = await deviceService.getDeviceById(deviceId);
        
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        return res.status(200).json({ success: true, data: device });
    } catch (error) {
        console.error('Error in getDeviceById:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * PUT /api/devices/mode
 * Update the operation mode (AUTO/MANUAL) for room devices.
 * Body payload: { "mode": "MANUAL" } or { "mode": "AUTO" }
 */
async function setOperationMode(req, res) {
    try {
        const { mode } = req.body;
        if (!['AUTO', 'MANUAL'].includes(mode)) {
            return res.status(400).json({ success: false, message: 'Invalid operation mode (Allowed: AUTO or MANUAL)' });
        }

        await deviceService.updateOperationMode(mode);
        return res.status(200).json({
            success: true,
            message: `Room operation mode updated to ${mode}`
        });
    } catch (error) {
        console.error('Error in setOperationMode:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * POST /api/devices/:id/control
 * Primary endpoint to dispatch a hardware control command.
 * Body payload: { "action": "TURN_ON" } (or TURN_OFF, OPEN, CLOSE, STOP)
 */
async function controlDevice(req, res) {
    try {
        const deviceId = req.params.id;
        const { action } = req.body;

        // Retrieve requesting username from JWT auth middleware, fallback to test user
        const requestedBy = (req.user && req.user.username) ? req.user.username : 'manager_test';

        // 1. Verify target device existence
        const device = await deviceService.getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // 2. Validate room operation mode (Reject manual controls in AUTO mode)
        if (device.operation_mode === 'AUTO') {
            return res.status(403).json({
                success: false,
                message: 'Room is currently in AUTO mode. Switch to MANUAL mode before issuing manual controls.'
            });
        }

        // 3. Generate unique command identifier
        const commandId = `CMD-${Date.now()}`;

        // 4. Persist command log entry with default PENDING status
        await deviceService.createCommand({
            commandId,
            deviceId,
            action,
            requestedBy,
            source: 'MANUAL'
        });

        // 5. [MQTT PUBLISH] Dispatch command payload to ESP32 Gateway via MQTT Service
        try {
            const mqttService = require('../services/mqttService');
            mqttService.publishCommand(deviceId, {
                command_id: commandId,
                device_id: deviceId,
                action: action,
                requested_by: requestedBy,
                timestamp: Math.floor(Date.now() / 1000)
            });
        } catch (mqttErr) {
            console.warn('MQTT Service unavailable (To be integrated in Step 3):', mqttErr.message);
        }

        // 6. Schedule 5-second ACK execution timeout
        const timer = setTimeout(async () => {
            const isUpdated = await deviceService.updateCommandTimeout(commandId);
            if (isUpdated) {
                console.warn(` [TIMEOUT] Command ${commandId} sent to ${deviceId} expired after 5s without ESP32 ACK`);
                
                // Broadcast WebSocket timeout event if WebSocket instance is bound
                const io = req.app.get('io');
                if (io) {
                    io.to('P.101').emit('device:command-update', {
                        command_id: commandId,
                        device_id: deviceId,
                        device_name: device.name,
                        action: action,
                        ack_status: 'TIMEOUT',
                        execution_time_ms: null
                    });
                }
            }
            pendingTimers.delete(commandId);
        }, 5000);

        pendingTimers.set(commandId, timer);

        // 7. Return HTTP 202 Accepted response to Web Frontend
        return res.status(202).json({
            success: true,
            message: 'Control command accepted, waiting for ESP32 ACK response',
            data: {
                command_id: commandId,
                device_id: deviceId,
                action: action,
                status: 'PENDING'
            }
        });

    } catch (error) {
        console.error('Error in controlDevice:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * GET /api/device-commands
 * Fetch recent device command history logs.
 */
async function getDeviceCommands(req, res) {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const commands = await deviceService.getRecentCommands(limit);
        return res.status(200).json({ success: true, data: commands });
    } catch (error) {
        console.error('Error in getDeviceCommands:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

/**
 * GET /api/device-commands/:id
 * Retrieve specific command history details by ID.
 */
async function getDeviceCommandById(req, res) {
    try {
        const commandId = req.params.id;
        const command = await deviceService.getCommandById(commandId);
        
        if (!command) {
            return res.status(404).json({ success: false, message: 'Command record not found' });
        }

        return res.status(200).json({ success: true, data: command });
    } catch (error) {
        console.error('Error in getDeviceCommandById:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    getDevices,
    getDeviceById,
    setOperationMode,
    controlDevice,
    getDeviceCommands,
    getDeviceCommandById,
    pendingTimers
};