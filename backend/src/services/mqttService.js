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
    const gatewayAckTopic = `classroom/${ROOM_ID}/gateway/ack`;

    const subscribeToTopics = () => {
        client.subscribe([ackTopic, statusTopic, gatewayAckTopic], { qos: 1 }, (error) => {
            if (error) {
                activeLogger.error?.('Device & Gateway MQTT subscriptions failed', { message: error.message });
                return;
            }
            activeLogger.info?.(`DEV 3 subscribed to ${ackTopic}, ${statusTopic}, and ${gatewayAckTopic}`);
        });
    };

    const handleMessage = async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            if (topic === gatewayAckTopic) {
                await handleGatewayAck(payload);
                return;
            }

            const topicDeviceId = extractDeviceIdFromTopic(topic);
            if (!topicDeviceId) return;
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

/** Process an ESP32 Gateway ACK (CONFIG_ACK or Mode Change COMMAND_ACK). */
async function handleGatewayAck(ackData) {
    activeLogger.info?.('Received ESP32 Gateway ACK', ackData);
    const realtime = expressApp?.get('realtime');

    if (ackData.event === 'CONFIG_ACK') {
        realtime?.publishToRoom(ROOM_ID, {
            event: 'gateway:config-ack',
            data: ackData,
        });
    } else if (ackData.event === 'COMMAND_ACK') {
        const commandService = expressApp?.get('deviceCommandService');
        if (commandService) {
            await commandService.handleAck(ackData, 'GATEWAY');
        } else {
            realtime?.publishToRoom(ROOM_ID, {
                event: 'gateway:mode-ack',
                data: ackData,
            });
        }
    }
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

/**
 * Publish updated automation rule thresholds to ESP32 Gateway via MQTT with QoS 1 and Retain flag.
 * ESP32 reads this config topic to update its local EEPROM/Flash threshold rules.
 */
function publishThresholdConfig(roomId = ROOM_ID, configPayload = {}) {
    if (!client || !client.connected) {
        activeLogger.warn?.('Cannot publish threshold config; MQTT client is not connected.');
        return false;
    }

    const topic = `classroom/${roomId}/config/thresholds`;
    const payload = JSON.stringify({
        event: 'CONFIG_UPDATE',
        room_id: roomId,
        ...configPayload,
        timestamp: Math.floor(Date.now() / 1000),
    });

    client.publish(topic, payload, { qos: 1, retain: true }, (error) => {
        if (error) {
            activeLogger.error?.('Failed to publish threshold config to MQTT', { topic, message: error.message });
        } else {
            activeLogger.info?.(`Published rule threshold config to MQTT [${topic}]`);
        }
    });

    return true;
}

/**
 * Publish mode change command payload to ESP32 Gateway via MQTT using QoS 1.
 * Topic: classroom/{roomId}/device/ALL/command
 */
function publishModeChange(roomId = ROOM_ID, modePayload = {}) {
    if (!client || !client.connected) {
        activeLogger.warn?.('Cannot publish mode change; MQTT client is not connected.');
        return false;
    }

    const topic = `classroom/${roomId}/device/ALL/command`;
    client.publish(topic, JSON.stringify(modePayload), { qos: 1 }, (error) => {
        if (error) {
            activeLogger.error?.('Failed to publish mode change to MQTT', { topic, message: error.message });
        } else {
            activeLogger.info?.(`Published mode change command to MQTT [${topic}]`);
        }
    });

    return true;
}

module.exports = {
    initMQTT,
    publishCommand,
    publishThresholdConfig,
    publishModeChange,
    handleDeviceAck,
    handleGatewayAck,
    handleDeviceStatus,
    isDeviceAckTopic,
};

