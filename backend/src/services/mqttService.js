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

function isDeviceStatusTopic(topic) {
    return new RegExp(`^${ROOM_TOPIC_PREFIX.replace('.', '\\.')}/[^/]+/status$`).test(topic);
}

function extractDeviceIdFromTopic(topic) {
    const match = topic.match(new RegExp(`^${ROOM_TOPIC_PREFIX.replace('.', '\\.')}/([^/]+)/(?:ack|status)$`));
    return match ? match[1] : null;
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
    const statusTopic = `${ROOM_TOPIC_PREFIX}/+/status`;

    const subscribeToTopics = () => {
        client.subscribe([ackTopic, statusTopic], { qos: 1 }, (error) => {
            if (error) {
                activeLogger.error?.('Device MQTT subscriptions failed', { message: error.message });
                return;
            }
            activeLogger.info?.(`DEV 3 subscribed to ${ackTopic} and ${statusTopic}`);
        });
    };

    const handleMessage = async (topic, message) => {
        const topicDeviceId = extractDeviceIdFromTopic(topic);
        if (!topicDeviceId) return;
        try {
            const payload = JSON.parse(message.toString());
            if (isDeviceStatusTopic(topic)) {
                await handleDeviceStatus(payload, topicDeviceId);
            } else if (isDeviceAckTopic(topic)) {
                await handleDeviceAck(payload, topicDeviceId);
            }
        } catch (error) {
            activeLogger.error?.('Invalid device ACK/status message', { topic, message: error.message });
        }
    };

    client.on('connect', subscribeToTopics);
    client.on('message', handleMessage);
    if (client.connected) queueMicrotask(subscribeToTopics);

    return () => {
        client.off?.('connect', subscribeToTopics);
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
async function handleDeviceAck(ackData, topicDeviceId = null) {
    const commandService = expressApp?.get('deviceCommandService');
    if (!commandService) {
        throw new Error('Device command service is unavailable');
    }
    return commandService.handleAck(ackData, topicDeviceId);
}

/** Process an ESP32 device status update. */
async function handleDeviceStatus(statusData, topicDeviceId = null) {
    const commandService = expressApp?.get('deviceCommandService');
    if (!commandService) {
        throw new Error('Device command service is unavailable');
    }
    return commandService.handleDeviceStatus(statusData, topicDeviceId);
}

module.exports = { initMQTT, publishCommand, handleDeviceAck, handleDeviceStatus, isDeviceAckTopic };
