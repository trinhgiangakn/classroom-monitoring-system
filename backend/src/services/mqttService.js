/**
 * Device command MQTT adapter. It registers on the shared MQTT client created
 * by DEV 1; it never opens an additional MQTT connection of its own.
 */

const ROOM_ID = 'P.101';
const ROOM_TOPIC_PREFIX = `classroom/${ROOM_ID}/device`;

let client = null;
let expressApp = null;
let activeLogger = console;

function isDeviceAckTopic(topic) {
    return new RegExp(`^${ROOM_TOPIC_PREFIX.replace('.', '\\.')}/[^/]+/ack$`).test(topic);
}

/**
 * Register DEV 3 ACK handling on the MQTT client shared with DEV 2.
 * @returns {() => void} cleanup function used during graceful shutdown.
 */
function initMQTT({ app, mqttClient, logger = console }) {
    if (!app) throw new TypeError('Express app is required');
    if (!mqttClient) {
        logger.warn?.('DEV 3 MQTT handlers are disabled because MQTT is unavailable.');
        return () => {};
    }

    client = mqttClient;
    expressApp = app;
    activeLogger = logger;
    const ackTopic = `${ROOM_TOPIC_PREFIX}/+/ack`;

    const subscribeToAcks = () => {
        client.subscribe(ackTopic, { qos: 1 }, (error) => {
            if (error) {
                activeLogger.error?.('Device ACK subscription failed', { message: error.message, ackTopic });
                return;
            }
            activeLogger.info?.(`DEV 3 subscribed to ${ackTopic}`);
        });
    };

    const handleMessage = async (topic, message) => {
        if (!isDeviceAckTopic(topic)) return;
        try {
            await handleDeviceAck(JSON.parse(message.toString()));
        } catch (error) {
            activeLogger.error?.('Invalid device ACK message', { topic, message: error.message });
        }
    };

    client.on('connect', subscribeToAcks);
    client.on('message', handleMessage);
    if (client.connected) queueMicrotask(subscribeToAcks);

    return () => {
        client.off?.('connect', subscribeToAcks);
        client.off?.('message', handleMessage);
        client = null;
        expressApp = null;
    };
}

/** Publish a command to ESP32 Gateway using QoS 1. */
function publishCommand(deviceId, commandPayload) {
    if (!client || !client.connected) {
        activeLogger.warn?.(`Cannot publish command ${commandPayload.command_id}; MQTT is not connected.`);
        return false;
    }

    const topic = `${ROOM_TOPIC_PREFIX}/${deviceId}/command`;
    client.publish(topic, JSON.stringify(commandPayload), { qos: 1 }, (error) => {
        if (error) activeLogger.error?.('Device command publish failed', { topic, message: error.message });
    });
    return true;
}

/** Process an ESP32 ACK and notify WebSocket clients plus DEV 4 alert logic. */
async function handleDeviceAck(ackData) {
    const commandService = expressApp?.get('deviceCommandService');
    if (!commandService) {
        throw new Error('Device command service is unavailable');
    }
    return commandService.handleAck(ackData);
}

module.exports = { initMQTT, publishCommand, handleDeviceAck, isDeviceAckTopic };
