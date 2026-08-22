/**
 * Publish one MQTT message that opens or recovers an operational alert.
 *
 * Examples:
 *   node send-alert-test.js temperature-high
 *   node send-alert-test.js recover-sensor
 */
const path = require('node:path');
const dotenv = require('./backend/node_modules/dotenv');
const mqtt = require('./backend/node_modules/mqtt');

dotenv.config({ path: path.join(__dirname, '.env'), quiet: true });

const roomId = process.env.TEST_ROOM_ID || 'P.101';
const nodeId = process.env.TEST_NODE_ID || 'NODE-NW';
const gatewayId = process.env.TEST_GATEWAY_ID || 'GW-P101-01';
const brokerUrl = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';

function telemetry(overrides = {}) {
  return {
    room_id: roomId,
    node_id: nodeId,
    temperature: 26,
    humidity: 55,
    pressure_hpa: 1008,
    light_lux: 450,
    air_quality_ppm: 70,
    status: 'VALID',
    ble_rssi: -60,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function nodeStatus(overrides = {}) {
  return {
    room_id: roomId,
    node_id: nodeId,
    status: 'ONLINE',
    sensor_health: 'OK',
    rssi: -60,
    packet_success_rate: 100,
    battery_percent: 100,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function gatewayStatus(overrides = {}) {
  return {
    room_id: roomId,
    gateway_id: gatewayId,
    status: 'ONLINE',
    wifi_connected: true,
    mqtt_connected: true,
    wifi_rssi: -55,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

function gatewayMetrics(overrides = {}) {
  return {
    room_id: roomId,
    gateway_id: gatewayId,
    cpu_usage_percent: 40,
    ram_heap_percent: 45,
    mqtt_queue_percent: 10,
    wifi_signal_dbm: -55,
    wifi_connected: true,
    mqtt_connected: true,
    uptime_seconds: 3600,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

const scenarios = {
  'temperature-high': () => ['telemetry', telemetry({ temperature: 31 })],
  'temperature-critical': () => ['telemetry', telemetry({ temperature: 36 })],
  'humidity-high': () => ['telemetry', telemetry({ humidity: 80 })],
  'pressure-high': () => ['telemetry', telemetry({ pressure_hpa: 1040 })],
  'light-low': () => ['telemetry', telemetry({ light_lux: 100 })],
  'air-quality-poor': () => ['telemetry', telemetry({ air_quality_ppm: 130 })],
  'sensor-invalid': () => ['telemetry', telemetry({ status: 'INVALID' })],
  'node-offline': () => ['node-status', nodeStatus({ status: 'OFFLINE', rssi: -90 })],
  'node-battery-low': () => ['node-status', nodeStatus({ battery_percent: 15 })],
  'node-packet-loss': () => ['node-status', nodeStatus({ packet_success_rate: 80 })],
  'gateway-offline': () => ['gateway-status', gatewayStatus({ status: 'OFFLINE', wifi_connected: false, mqtt_connected: false })],
  'gateway-cpu-high': () => ['gateway-metrics', gatewayMetrics({ cpu_usage_percent: 90 })],
  'recover-sensor': () => ['telemetry', telemetry()],
  'recover-node': () => ['node-status', nodeStatus()],
  'recover-gateway': () => ['gateway-metrics', gatewayMetrics()],
};

const scenarioName = process.argv[2];
if (!scenarios[scenarioName]) {
  console.error(`Kịch bản không hợp lệ. Chọn một trong: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const [topicType, payload] = scenarios[scenarioName]();
const topicByType = {
  telemetry: `classroom/${roomId}/sensor/${nodeId}/telemetry`,
  'node-status': `classroom/${roomId}/sensor/${nodeId}/status`,
  'gateway-status': `classroom/${roomId}/gateway/status`,
  'gateway-metrics': `classroom/${roomId}/gateway/metrics`,
};

const options = {
  clientId: `alert-test-${process.pid}-${Date.now()}`,
};
if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

const client = mqtt.connect(brokerUrl, options);
const timeout = setTimeout(() => {
  console.error(`Không kết nối được MQTT broker ${brokerUrl}.`);
  client.end(true);
  process.exitCode = 1;
}, 7000);

client.once('connect', () => {
  const topic = topicByType[topicType];
  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
    clearTimeout(timeout);
    if (error) {
      console.error('Gửi MQTT thất bại:', error.message);
      process.exitCode = 1;
    } else {
      console.log(`Đã gửi '${scenarioName}' tới ${topic}`);
      console.log(JSON.stringify(payload, null, 2));
    }
    client.end();
  });
});

client.once('error', (error) => {
  clearTimeout(timeout);
  console.error('Lỗi MQTT:', error.message);
  client.end(true);
  process.exitCode = 1;
});
