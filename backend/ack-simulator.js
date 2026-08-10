/**
 * @fileoverview ESP32 Gateway Simulator for Room P.101
 * Simulates hardware execution and publishes ACK responses back to MQTT broker.
 */

const mqtt = require('mqtt');

// Public MQTT broker endpoint aligned with backend configuration
const MQTT_BROKER = 'mqtt://broker.emqx.io:1883';
const ROOM_TOPIC_PREFIX = 'classroom/P.101/device';

// Initialize MQTT client with randomized client ID to avoid connection collisions
const client = mqtt.connect(MQTT_BROKER, {
    clientId: `esp32_simulator_p101_${Math.random().toString(16).substring(2, 6)}`,
    clean: true,
    connectTimeout: 10000
});

/**
 * Handle successful connection to MQTT broker.
 */
client.on('connect', () => {
    console.log('[ESP32 SIMULATOR] Connected to Public MQTT Broker successfully!');

    // Subscribe to all device command topics under room P.101
    const commandTopic = `${ROOM_TOPIC_PREFIX}/+/command`;
    client.subscribe(commandTopic, (err) => {
        if (!err) {
            console.log(`[ESP32 SIMULATOR] Subscribed & listening on topic pattern: ${commandTopic}`);
        } else {
            console.error('[ESP32 SIMULATOR] Subscription error:', err);
        }
    });
});

/**
 * Handle incoming command messages from backend server.
 */
client.on('message', (topic, message) => {
    try {
        const command = JSON.parse(message.toString());
        console.log(`[ESP32 SIMULATOR] Received command from topic [${topic}]:`, command);

        const { command_id, device_id, action } = command;

        // Map requested action to physical hardware state
        let actualState = 'OFF';
        if (action === 'TURN_ON') actualState = 'ON';
        if (action === 'TURN_OFF') actualState = 'OFF';
        if (action === 'OPEN') actualState = 'OPENING';
        if (action === 'CLOSE') actualState = 'CLOSING';
        if (action === 'STOP') actualState = 'STOPPED';

        // Simulate physical execution latency (50ms - 150ms)
        const executionTimeMs = Math.floor(Math.random() * 100) + 50;

        setTimeout(() => {
            // Construct ACK payload object
            const ackPayload = {
                command_id: command_id,
                device_id: device_id,
                status: 'SUCCESS',
                execution_time_ms: executionTimeMs,
                actual_state: actualState,
                timestamp: Math.floor(Date.now() / 1000)
            };

            const ackTopic = `${ROOM_TOPIC_PREFIX}/${device_id}/ack`;
            client.publish(ackTopic, JSON.stringify(ackPayload), { qos: 1 });

            console.log(`[ESP32 SIMULATOR] Sent ACK to [${ackTopic}]:`, ackPayload);
        }, executionTimeMs);

    } catch (error) {
        console.error('[ESP32 SIMULATOR] Error processing incoming command:', error.message);
    }
});

/**
 * Handle connection error events.
 */
client.on('error', (err) => {
    console.error('[ESP32 SIMULATOR] Connection error:', err.message);
});