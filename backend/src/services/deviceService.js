const db = require('../config/db');

const DEFAULT_DEVICES = [
    { device_id: 'LIGHT_01', name: 'Đèn chiếu sáng', type: 'RELAY', actual_state: 'ON', desired_state: 'ON', operation_mode: 'MANUAL', limit_open_status: 'OK', limit_close_status: 'OK', timeout_seconds: 30 },
    { device_id: 'FAN_01', name: 'Quạt thông gió', type: 'RELAY', actual_state: 'ON', desired_state: 'ON', operation_mode: 'MANUAL', limit_open_status: 'OK', limit_close_status: 'OK', timeout_seconds: 30 },
    { device_id: 'HUMIDIFIER_01', name: 'Máy cấp ẩm', type: 'RELAY', actual_state: 'OFF', desired_state: 'OFF', operation_mode: 'MANUAL', limit_open_status: 'OK', limit_close_status: 'OK', timeout_seconds: 30 },
    { device_id: 'CURTAIN_01', name: 'Rèm cửa', type: 'MOTOR', actual_state: 'STOPPED', desired_state: 'STOPPED', operation_mode: 'MANUAL', limit_open_status: 'OK', limit_close_status: 'OK', timeout_seconds: 30 },
];

/**
 * Retrieve all registered devices from the database.
 * If any of the 4 core devices is missing, auto-seeds them with proper UTF-8 names.
 * @returns {Promise<Array>} Array of device records.
 */
async function getAllDevices() {
    try {
        const [rows] = await db.query('SELECT * FROM devices ORDER BY FIELD(device_id, "LIGHT_01", "FAN_01", "HUMIDIFIER_01", "CURTAIN_01")');
        if (rows && rows.length >= 4) {
            return rows;
        }

        // Auto-seed missing devices
        for (const dev of DEFAULT_DEVICES) {
            await db.query(
                `INSERT INTO devices (device_id, name, type, actual_state, desired_state, operation_mode, limit_open_status, limit_close_status, timeout_seconds)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)`,
                [dev.device_id, dev.name, dev.type, dev.actual_state, dev.desired_state, dev.operation_mode, dev.limit_open_status, dev.limit_close_status, dev.timeout_seconds]
            );
        }
        const [seededRows] = await db.query('SELECT * FROM devices ORDER BY FIELD(device_id, "LIGHT_01", "FAN_01", "HUMIDIFIER_01", "CURTAIN_01")');
        return seededRows && seededRows.length > 0 ? seededRows : DEFAULT_DEVICES;
    } catch (error) {
        console.warn('Database devices query fallback to memory defaults:', error.message);
        return DEFAULT_DEVICES;
    }
}

/**
 * Retrieve detailed information for a specific device by its ID.
 * @param {string} deviceId - The unique identifier of the device.
 * @returns {Promise<Object|null>} Device record or null if not found.
 */
async function getDeviceById(deviceId) {
    try {
        const [rows] = await db.query('SELECT * FROM devices WHERE device_id = ?', [deviceId]);
        if (rows && rows[0]) return rows[0];
    } catch (err) {
        console.warn('getDeviceById DB query failed, falling back:', err.message);
    }
    return DEFAULT_DEVICES.find(d => d.device_id === deviceId) || null;
}

/**
 * Update the operation mode (AUTO/MANUAL) for all devices in the room.
 * @param {string} mode - The new operation mode ('AUTO' or 'MANUAL').
 * @returns {Promise<number>} Number of affected rows in the database.
 */
async function updateOperationMode(mode) {
    try {
        const [result] = await db.query('UPDATE devices SET operation_mode = ?', [mode]);
        return result.affectedRows;
    } catch (err) {
        console.warn('updateOperationMode DB query failed:', err.message);
        DEFAULT_DEVICES.forEach(d => { d.operation_mode = mode; });
        return DEFAULT_DEVICES.length;
    }
}

/**
 * Create a new device command log with PENDING status and update the desired state.
 * @param {Object} params - Command parameters.
 * @param {string} params.commandId - Unique identifier for the command.
 * @param {string} params.deviceId - Target device identifier.
 * @param {string} params.action - Target action (e.g., 'TURN_ON', 'TURN_OFF').
 * @param {string} params.requestedBy - Username of the requester.
 * @param {string} params.source - Command trigger source ('MANUAL' or 'AUTO').
 * @returns {Promise<Object>} MySQL insert execution result.
 */
async function createCommand({ commandId, deviceId, action, requestedBy, source }) {
    try {
        // Update target state (desired_state) in devices table
        await db.query(
            'UPDATE devices SET desired_state = ? WHERE device_id = ?',
            [action, deviceId]
        );

        // Record command history entry with default status 'PENDING'
        const sql = `
            INSERT INTO device_commands (command_id, device_id, action, requested_by, source, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `;
        const [result] = await db.query(sql, [commandId, deviceId, action, requestedBy, source]);
        return result;
    } catch (err) {
        console.warn('createCommand DB query failed:', err.message);
        return { insertId: commandId };
    }
}

/**
 * Mark a command status as TIMEOUT if no ACK was received from ESP32 within 5 seconds.
 * @param {string} commandId - Unique command identifier.
 * @returns {Promise<boolean>} Returns true if status was successfully updated from PENDING to TIMEOUT.
 */
async function updateCommandTimeout(commandId) {
    try {
        const sql = `
            UPDATE device_commands 
            SET status = 'TIMEOUT' 
            WHERE command_id = ? AND status = 'PENDING'
        `;
        const [result] = await db.query(sql, [commandId]);
        return result.affectedRows > 0;
    } catch (err) {
        console.warn('updateCommandTimeout DB query failed:', err.message);
        return false;
    }
}

async function updateCommandResult(commandId, { status, executionTimeMs }) {
    try {
        const sql = `
            UPDATE device_commands
            SET status = ?, execution_time_ms = ?, ack_received_at = CURRENT_TIMESTAMP
            WHERE command_id = ? AND status = 'PENDING'
        `;
        const [result] = await db.query(sql, [status, executionTimeMs, commandId]);
        return result.affectedRows > 0;
    } catch (err) {
        console.warn('updateCommandResult DB query failed:', err.message);
        return true;
    }
}

async function updateActualState(deviceId, actualState) {
    try {
        const [result] = await db.query(
            'UPDATE devices SET actual_state = ? WHERE device_id = ?',
            [actualState, deviceId],
        );
        return result.affectedRows > 0;
    } catch (err) {
        console.warn('updateActualState DB query failed:', err.message);
        const dev = DEFAULT_DEVICES.find(d => d.device_id === deviceId);
        if (dev) dev.actual_state = actualState;
        return true;
    }
}

/**
 * Fetch recent command execution logs joined with device information.
 * @param {number} [limit=20] - Maximum number of command logs to retrieve.
 * @returns {Promise<Array>} List of command log entries.
 */
async function getRecentCommands(limit = 20) {
    try {
        const sql = `
            SELECT 
                c.command_id, 
                c.device_id, 
                d.name AS device_name, 
                c.action, 
                c.requested_by,
                c.source,
                c.status, 
                c.execution_time_ms, 
                c.requested_at,
                c.ack_received_at
            FROM device_commands c
            LEFT JOIN devices d ON c.device_id = d.device_id
            ORDER BY c.requested_at DESC
            LIMIT ?
        `;
        const [rows] = await db.query(sql, [limit]);
        return rows || [];
    } catch (err) {
        console.warn('getRecentCommands DB query failed:', err.message);
        return [];
    }
}

/**
 * Retrieve detailed command record by command ID.
 * @param {string} commandId - Unique identifier of the command log.
 * @returns {Promise<Object|null>} Command record or null if not found.
 */
async function getCommandById(commandId) {
    try {
        const sql = `
            SELECT c.*, d.name AS device_name 
            FROM device_commands c
            LEFT JOIN devices d ON c.device_id = d.device_id
            WHERE c.command_id = ?
        `;
        const [rows] = await db.query(sql, [commandId]);
        return rows[0] || null;
    } catch (err) {
        console.warn('getCommandById DB query failed:', err.message);
        return null;
    }
}

module.exports = {
    getAllDevices,
    getDeviceById,
    updateOperationMode,
    createCommand,
    updateCommandTimeout,
    updateCommandResult,
    updateActualState,
    getRecentCommands,
    getCommandById
};
