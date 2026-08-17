/**
 * @fileoverview ESP32 Gateway Simulator for Room P.101
 * Simulates hardware execution, publishes heartbeat & metrics, and sends ACK responses.
 * Automatically reads MQTT_URL from .env to match the backend connection.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const mqtt = require('mqtt');

// ✅ Use same broker as backend (reads from .env → MQTT_URL)
const MQTT_BROKER = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || undefined;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || undefined;
const ROOM_ID = 'P.101';
const GATEWAY_ID = 'GW-P101-01';
const ROOM_TOPIC_PREFIX = `classroom/${ROOM_ID}/device`;

console.log(`[ESP32 SIMULATOR] Connecting to MQTT Broker: ${MQTT_BROKER}`);

let uptimeSeconds = 0;
let heartbeatTimer = null;

// LWT payload: sent automatically by broker if simulator crashes or connection drops
const lwtPayload = JSON.stringify({
    gateway_id: GATEWAY_ID,
    status: 'OFFLINE',
    wifi_connected: false,
    mqtt_connected: false,
    wifi_rssi: null,
    ip_address: null,
    firmware_version: '1.0.0',
    timestamp: Math.floor(Date.now() / 1000),
});

const client = mqtt.connect(MQTT_BROKER, {
    clientId: `esp32_gateway_${ROOM_ID.replace('.', '_')}_${Math.random().toString(16).substring(2, 6)}`,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    will: {
        topic: `classroom/${ROOM_ID}/gateway/status`,
        payload: lwtPayload,
        qos: 1,
        retain: false,
    },
});

function publishGatewayStatus(status = 'ONLINE') {
    const isOnline = status === 'ONLINE';
    const payload = {
        gateway_id: GATEWAY_ID,
        status: status,
        wifi_connected: isOnline,
        mqtt_connected: isOnline,
        wifi_rssi: isOnline ? -58 : null,
        ip_address: isOnline ? '192.168.1.101' : null,
        firmware_version: '1.0.0',
        timestamp: Math.floor(Date.now() / 1000),
    };
    client.publish(`classroom/${ROOM_ID}/gateway/status`, JSON.stringify(payload), { qos: 1 });
}

function publishGatewayMetrics() {
    uptimeSeconds += 10;
    const cpu = Math.floor(Math.random() * 8) + 28; // 28% - 35%
    const ram = Math.floor(Math.random() * 5) + 55; // 55% - 60%
    const queue = Math.floor(Math.random() * 6) + 8; // 8% - 14%

    const payload = {
        gateway_id: GATEWAY_ID,
        cpu_usage_percent: cpu,
        ram_heap_percent: ram,
        mqtt_queue_percent: queue,
        uptime_seconds: uptimeSeconds,
        timestamp: Math.floor(Date.now() / 1000),
    };
    client.publish(`classroom/${ROOM_ID}/gateway/metrics`, JSON.stringify(payload), { qos: 1 });
}

/**
 * Handle successful connection to MQTT broker.
 */
client.on('connect', () => {
    console.log(`[ESP32 SIMULATOR] ✅ Connected to Broker: ${MQTT_BROKER}`);

    // Publish initial status & metrics
    publishGatewayStatus('ONLINE');
    publishGatewayMetrics();
    console.log(`[ESP32 SIMULATOR] 🟢 Gateway status ONLINE published to [classroom/${ROOM_ID}/gateway/status]`);

    // Periodic heartbeat every 10 seconds
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        publishGatewayStatus('ONLINE');
        publishGatewayMetrics();
    }, 10_000);

    const commandTopic = `${ROOM_TOPIC_PREFIX}/+/command`;
    client.subscribe(commandTopic, { qos: 1 }, (err) => {
        if (!err) {
            console.log(`[ESP32 SIMULATOR] 👂 Listening on: ${commandTopic}`);
            console.log(`[ESP32 SIMULATOR] Ready — bấm Bật/Tắt thiết bị trên Web để test!\n`);
        } else {
            console.error('[ESP32 SIMULATOR] Subscription error:', err.message);
        }
    });
});

/**
 * Map action → physical state result.
 */
function actionToState(action) {
    const map = {
        TURN_ON:  'ON',
        TURN_OFF: 'OFF',
        OPEN:     'OPENING',
        CLOSE:    'CLOSING',
        STOP:     'STOPPED',
    };
    return map[action] ?? 'UNKNOWN';
}

/**
 * Handle incoming command messages from backend server.
 */
client.on('message', (topic, message) => {
    try {
        const command = JSON.parse(message.toString());
        const { command_id, device_id, action, source } = command;

        console.log(`\n[ESP32 SIMULATOR] 📩 Received command:`);
        console.log(`   Topic:     ${topic}`);
        console.log(`   CommandID: ${command_id}`);
        console.log(`   Device:    ${device_id}`);
        console.log(`   Action:    ${action}`);
        console.log(`   Source:    ${source}`);

        const executionTimeMs = Math.floor(Math.random() * 100) + 50;
        const actualState = actionToState(action);

        setTimeout(() => {
            const ackPayload = {
                command_id,
                device_id,
                status: 'SUCCESS',
                execution_time_ms: executionTimeMs,
                actual_state: actualState,
                timestamp: Math.floor(Date.now() / 1000),
            };

            const ackTopic = `${ROOM_TOPIC_PREFIX}/${device_id}/ack`;
            client.publish(ackTopic, JSON.stringify(ackPayload), { qos: 1 });

            console.log(`[ESP32 SIMULATOR] ✅ ACK sent → [${ackTopic}]`);
            console.log(`   Status:     ${ackPayload.status}`);
            console.log(`   ActualState:${ackPayload.actual_state}`);
            console.log(`   ExecTime:   ${executionTimeMs}ms\n`);
        }, executionTimeMs);

    } catch (error) {
        console.error('[ESP32 SIMULATOR] Error processing command:', error.message);
    }
});

client.on('error', (err) => {
    console.error('[ESP32 SIMULATOR] ❌ Connection error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
        console.error('[ESP32 SIMULATOR] Hint: Ensure MQTT Broker (Mosquitto) is running on', MQTT_BROKER);
    }
});

client.on('reconnect', () => {
    console.log('[ESP32 SIMULATOR] 🔄 Reconnecting to broker...');
});

client.on('offline', () => {
    console.log('[ESP32 SIMULATOR] ⚠️  Offline — waiting for broker connection...');
});

function shutdown() {
    console.log('\n[ESP32 SIMULATOR] 🔴 Publishing OFFLINE status to gateway...');
    if (heartbeatTimer) clearInterval(heartbeatTimer);

    publishGatewayStatus('OFFLINE');

    setTimeout(() => {
        console.log('[ESP32 SIMULATOR] Shutting down cleanly...');
        client.end(true, () => process.exit(0));
    }, 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);