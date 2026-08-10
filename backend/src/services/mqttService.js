/**
 * @fileoverview MQTT Service module for handling device communications and ACK responses.
 */

const mqtt = require('mqtt');
const db = require('../config/db');

// MQTT Broker connection configuration (Default to EMQX public broker on port 1883)
const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
const ROOM_TOPIC_PREFIX = 'classroom/P.101/device';

let client = null;
let expressApp = null;

/**
 * Initialize and establish connection to the MQTT broker.
 * @param {Object} app - Express application instance used to access Socket.io.
 */
function initMQTT(app) {
    expressApp = app;

    client = mqtt.connect(MQTT_BROKER, {
        clientId: `backend_dev3_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 3000
    });

    client.on('connect', () => {
        console.log(`[MQTT] Successfully connected to Public Broker at ${MQTT_BROKER}`);

        const ackTopic = `${ROOM_TOPIC_PREFIX}/+/ack`;
        client.subscribe(ackTopic, (err) => {
            if (!err) {
                console.log(`[MQTT] Subscribed to ACK topic pattern: ${ackTopic}`);
            } else {
                console.error('[MQTT] Subscription error:', err);
            }
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            console.log(`[MQTT] Message received on [${topic}]:`, payload);

            if (topic.endsWith('/ack')) {
                await handleDeviceAck(payload);
            }
        } catch (parseErr) {
            console.error('[MQTT] Failed to parse incoming JSON message:', parseErr.message);
        }
    });

    client.on('error', (error) => {
        console.error('[MQTT] Connection error:', error.message);
    });
}

/**
 * Publish a hardware control command to the device's MQTT topic.
 * @param {string} deviceId - Target device ID (e.g., 'RELAY_1', 'CURTAIN_MOTOR').
 * @param {Object} commandPayload - Command message object.
 * @returns {boolean} True if published successfully, false otherwise.
 */
function publishCommand(deviceId, commandPayload) {
    if (!client || !client.connected) {
        console.warn(`[MQTT] Cannot publish command ${commandPayload.command_id}. Broker not connected.`);
        return false;
    }

    const topic = `${ROOM_TOPIC_PREFIX}/${deviceId}/command`;
    const messageStr = JSON.stringify(commandPayload);

    client.publish(topic, messageStr, { qos: 1 }, (err) => {
        if (err) {
            console.error(`[MQTT] Failed to publish command to ${topic}:`, err);
        } else {
            console.log(`[MQTT] Command published to [${topic}]:`, messageStr);
        }
    });

    return true;
}

/**
 * Process ACK response payload received from ESP32 Gateway.
 * @param {Object} ackData - ACK message payload.
 * @param {string} ackData.command_id - Unique command identifier.
 * @param {string} ackData.device_id - Device ID.
 * @param {string} ackData.status - Execution status ('SUCCESS' or 'FAILED').
 * @param {number} ackData.execution_time_ms - Execution duration in milliseconds.
 * @param {string} [ackData.actual_state] - Updated physical device state ('ON', 'OFF', etc.).
 */
async function handleDeviceAck(ackData) {
    const { command_id, device_id, status, execution_time_ms, actual_state } = ackData;

    try {
        // 1. Clear pending timeout timer if it exists in deviceController
        const deviceController = require('../controllers/deviceController');
        if (deviceController.pendingTimers.has(command_id)) {
            clearTimeout(deviceController.pendingTimers.get(command_id));
            deviceController.pendingTimers.delete(command_id);
            console.log(`[TIMER] Cleared 5s timeout timer for command: ${command_id}`);
        }

        // 2. Update device_commands history table status
        const updateCmdSql = `
            UPDATE device_commands 
            SET status = ?, 
                execution_time_ms = ?, 
                ack_received_at = CURRENT_TIMESTAMP 
            WHERE command_id = ? AND status = 'PENDING'
        `;
        const [cmdResult] = await db.query(updateCmdSql, [status, execution_time_ms || 0, command_id]);

        if (cmdResult.affectedRows === 0) {
            console.warn(`[MQTT] ACK ignored for ${command_id}. Command was either processed or timed out.`);
            return;
        }

        // 3. Update actual_state in devices table if state update is provided
        if (status === 'SUCCESS' && actual_state) {
            await db.query(
                'UPDATE devices SET actual_state = ? WHERE device_id = ?',
                [actual_state, device_id]
            );
            console.log(`[DB] Device ${device_id} actual_state updated to: ${actual_state}`);
        }

        // 4. Emit WebSocket real-time event to Web UI clients
        if (expressApp) {
            const io = expressApp.get('io');
            if (io) {
                // Broadcast command execution update
                io.to('P.101').emit('device:command-update', {
                    command_id,
                    device_id,
                    ack_status: status,
                    execution_time_ms
                });

                // Broadcast device status update if state changed successfully
                if (status === 'SUCCESS' && actual_state) {
                    io.to('P.101').emit('device:status', {
                        device_id,
                        actual_state
                    });
                }

                console.log(`[WEBSOCKET] Emitted real-time updates for command: ${command_id}`);
            }
        }

    } catch (dbErr) {
        console.error('[MQTT] Error handling device ACK in database:', dbErr);
    }
}

module.exports = {
    initMQTT,
    publishCommand
};