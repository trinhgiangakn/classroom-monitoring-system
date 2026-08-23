const { randomUUID } = require('crypto');
const deviceService = require('../services/deviceService');
const { DeviceCommandError } = require('../services/deviceCommandService');
const mqttService = require('../services/mqttService');

/**
 * GET /api/devices
 * Retrieve the list of all registered devices along with room mode and lock state.
 */
async function getDevices(req, res) {
    try {
        const devices = await deviceService.getAllDevices();
        const operationMode = devices[0]?.operation_mode || 'MANUAL';
        return res.status(200).json({
            success: true,
            room_id: 'P.101',
            operation_mode: operationMode,
            manual_control_locked: operationMode === 'AUTO',
            devices: devices,
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
 * Body payload: { "mode": "MANUAL", "room_id": "P.101" } or { "mode": "AUTO" }
 */
async function setOperationMode(req, res) {
    try {
        const { mode, room_id = 'P.101' } = req.body;
        if (!['AUTO', 'MANUAL'].includes(mode)) {
            return res.status(400).json({ success: false, message: 'Invalid operation mode (Allowed: AUTO or MANUAL)' });
        }

        await deviceService.updateOperationMode(mode);

        // Broadcast MQTT mode change payload to HiveMQ Broker for ESP32 Gateway
        const commandId = `CMD-${randomUUID()}`;
        const requestedBy = req.user?.username || 'admin';
        const action = mode === 'AUTO' ? 'RESUME' : 'PAUSE';
        const source = mode;
        const reason = mode === 'AUTO' ? 'user_switched_to_auto' : 'user_switched_to_manual';
        const timestamp = Math.floor(Date.now() / 1000);

        const modePayload = {
            command_id: commandId,
            device_id: 'ALL',
            action,
            requested_by: requestedBy,
            source,
            reason,
            timestamp,
        };

        const mqttPublished = mqttService.publishModeChange(room_id, modePayload);

        // Notify realtime room subscribers if WebSocket is initialized
        const realtime = req.app.get('realtime');
        realtime?.publishToRoom(room_id, {
            event: 'mode:update',
            data: { room_id, current_mode: mode, payload: modePayload }
        });

        return res.status(200).json({
            success: true,
            room_id,
            current_mode: mode,
            command_id: commandId,
            mqtt_published: mqttPublished,
            payload: modePayload,
            message: mode === 'MANUAL'
                ? 'Đã chuyển sang chế độ MANUAL. Nút bấm điều khiển tay đã được mở khóa.'
                : 'Đã chuyển sang chế độ AUTO. Các điều khiển thủ công đã bị khóa.'
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

        if (!action) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số action (TURN_ON, TURN_OFF, OPEN, CLOSE, STOP)' });
        }

        const commandService = req.app.get('deviceCommandService');
        if (!commandService) {
            throw new DeviceCommandError('Device command service is unavailable', 503);
        }

        const command = await commandService.dispatch({
            deviceId,
            action,
            source: 'MANUAL',
            requestedBy: req.user?.username || 'admin',
        });

        return res.status(202).json({
            success: true,
            command_id: command.commandId,
            device_id: command.deviceId,
            device_name: command.deviceName ?? deviceId,
            action: command.action,
            status: 'PENDING_ACK',
            message: `Đã gửi lệnh ${action === 'TURN_ON' ? 'BẬT' : action === 'TURN_OFF' ? 'TẮT' : action} ${command.deviceName ?? deviceId}. Lệnh đã được chuyển tới ESP32 Gateway và đang chờ phản hồi ACK`,
            hint: 'Đảm bảo ack-simulator.js đang chạy và kết nối cùng MQTT Broker với Backend để nhận ACK'
        });

    } catch (error) {
        if (error instanceof DeviceCommandError) {
            const statusCode = error.statusCode || 400;
            const hint = statusCode === 503
                ? 'MQTT Broker chưa kết nối. Khởi động Mosquitto và chạy lại backend.'
                : statusCode === 403
                ? 'Phòng đang ở chế độ AUTO — chuyển về MANUAL trước khi điều khiển thủ công.'
                : undefined;
            return res.status(statusCode).json({ success: false, message: error.message, hint });
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
