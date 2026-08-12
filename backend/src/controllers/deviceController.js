const deviceService = require('../services/deviceService');
const { DeviceCommandError } = require('../services/deviceCommandService');

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
        const commandService = req.app.get('deviceCommandService');
        if (!commandService) {
            throw new DeviceCommandError('Device command service is unavailable', 503);
        }
        const command = await commandService.dispatch({
            deviceId,
            action,
            source: 'MANUAL',
            requestedBy: req.user?.username,
        });

        return res.status(202).json({
            success: true,
            message: 'Control command accepted, waiting for ESP32 ACK response',
            data: {
                command_id: command.commandId,
                device_id: command.deviceId,
                action: command.action,
                status: command.status,
            }
        });

    } catch (error) {
        if (error instanceof DeviceCommandError) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
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
};
