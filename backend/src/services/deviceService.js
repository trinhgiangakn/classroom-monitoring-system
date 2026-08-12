const db = require('../config/db');

/**
 * Retrieve all registered devices from the database.
 * @returns {Promise<Array>} Array of device records.
 */
async function getAllDevices() {
    const [rows] = await db.query('SELECT * FROM devices');
    return rows;
}

/**
 * Retrieve detailed information for a specific device by its ID.
 * @param {string} deviceId - The unique identifier of the device.
 * @returns {Promise<Object|null>} Device record or null if not found.
 */
async function getDeviceById(deviceId) {
    const [rows] = await db.query('SELECT * FROM devices WHERE device_id = ?', [deviceId]);
    return rows[0] || null;
}

/**
 * Update the operation mode (AUTO/MANUAL) for all devices in the room.
 * @param {string} mode - The new operation mode ('AUTO' or 'MANUAL').
 * @returns {Promise<number>} Number of affected rows in the database.
 */
async function updateOperationMode(mode) {
    const [result] = await db.query('UPDATE devices SET operation_mode = ?', [mode]);
    return result.affectedRows;
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
}

/**
 * Mark a command status as TIMEOUT if no ACK was received from ESP32 within 5 seconds.
 * @param {string} commandId - Unique command identifier.
 * @returns {Promise<boolean>} Returns true if status was successfully updated from PENDING to TIMEOUT.
 */
async function updateCommandTimeout(commandId) {
    const sql = `
        UPDATE device_commands 
        SET status = 'TIMEOUT' 
        WHERE command_id = ? AND status = 'PENDING'
    `;
    const [result] = await db.query(sql, [commandId]);
    return result.affectedRows > 0; // True if record was updated (i.e., was previously PENDING)
}

async function updateCommandResult(commandId, { status, executionTimeMs }) {
    const sql = `
        UPDATE device_commands
        SET status = ?, execution_time_ms = ?, ack_received_at = CURRENT_TIMESTAMP
        WHERE command_id = ? AND status = 'PENDING'
    `;
    const [result] = await db.query(sql, [status, executionTimeMs, commandId]);
    return result.affectedRows > 0;
}

async function updateActualState(deviceId, actualState) {
    const [result] = await db.query(
        'UPDATE devices SET actual_state = ? WHERE device_id = ?',
        [actualState, deviceId],
    );
    return result.affectedRows > 0;
}

/**
 * Fetch recent command execution logs joined with device information.
 * @param {number} [limit=20] - Maximum number of command logs to retrieve.
 * @returns {Promise<Array>} List of command log entries.
 */
async function getRecentCommands(limit = 20) {
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
    return rows;
}

/**
 * Retrieve detailed command record by command ID.
 * @param {string} commandId - Unique identifier of the command log.
 * @returns {Promise<Object|null>} Command record or null if not found.
 */
async function getCommandById(commandId) {
    const sql = `
        SELECT c.*, d.name AS device_name 
        FROM device_commands c
        LEFT JOIN devices d ON c.device_id = d.device_id
        WHERE c.command_id = ?
    `;
    const [rows] = await db.query(sql, [commandId]);
    return rows[0] || null;
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
