const mqtt = require('mqtt');

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function buildMqttOptions(env = process.env) {
    const randomSuffix = Math.random().toString(16).substring(2, 8);
    const baseId = env.MQTT_CLIENT_ID || 'classroom-backend';
    const options = {
        clientId: `${baseId}-${randomSuffix}`,
        clean: true,
        connectTimeout: positiveNumber(env.MQTT_CONNECT_TIMEOUT_MS, 10_000),
        reconnectPeriod: positiveNumber(env.MQTT_RECONNECT_PERIOD_MS, 2_000),
        resubscribe: true,
        queueQoSZero: false,
    };

    if (env.MQTT_USERNAME) options.username = env.MQTT_USERNAME;
    if (env.MQTT_PASSWORD) options.password = env.MQTT_PASSWORD;
    return options;
}

function createMqttClient({ env = process.env, logger = console } = {}) {
    if (env.MQTT_ENABLED === 'false') return null;

    const url = env.MQTT_URL || 'mqtt://127.0.0.1:1883';
    const client = mqtt.connect(url, buildMqttOptions(env));

    client.on('connect', () => logger.info?.(`MQTT connected: ${url}`));
    client.on('reconnect', () => logger.info?.(`MQTT reconnecting: ${url}`));
    client.on('offline', () => logger.warn?.(`MQTT offline: ${url}`));
    client.on('error', error => logger.error?.('MQTT client error', { message: error.message }));
    return client;
}

function endClient(client) {
    return new Promise(resolve => client.end(false, {}, resolve));
}

function attachMqttIngestion({ client, ingestion, logger = console }) {
    if (!client || !ingestion) return async () => {};

    let stopped = false;
    let starting = null;
    const start = () => {
        if (stopped || ingestion.started || starting) return;
        starting = Promise.resolve(ingestion.start())
            .then(() => logger.info?.('Dev 2 MQTT subscriptions are active.'))
            .catch(error => logger.error?.('Dev 2 MQTT subscription failed', { message: error.message }))
            .finally(() => { starting = null; });
    };

    client.on('connect', start);
    if (client.connected) queueMicrotask(start);

    return async () => {
        stopped = true;
        client.off('connect', start);
        if (starting) await starting;

        if (ingestion.started && client.connected) {
            await ingestion.stop();
        } else if (ingestion.started) {
            client.off?.('message', ingestion.handleMessage);
            ingestion.started = false;
        }

        await endClient(client);
    };
}

module.exports = { attachMqttIngestion, buildMqttOptions, createMqttClient };
