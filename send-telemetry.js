/**
 * Smart Classroom - MQTT Telemetry Simulator Script
 * Usage:
 *   node send-telemetry.js              (Bắn 1 gói tin mẫu)
 *   node send-telemetry.js --loop       (Tự động bắn liên tục mỗi 5 giây như ESP32 thật)
 */

const mqtt = require('./backend/node_modules/mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
const ROOM_ID = 'P.101';
const NODES = ['NODE-NW', 'NODE-NE', 'NODE-SW', 'NODE-SE'];

const client = mqtt.connect(BROKER_URL);

console.log('\n======================================================');
console.log('📡 SMART CLASSROOM - MQTT TELEMETRY SIMULATOR');
console.log(`🔗 Broker: ${BROKER_URL} | Phòng: ${ROOM_ID}`);
console.log('======================================================\n');

function generatePayload(nodeId) {
  const now = Math.floor(Date.now() / 1000);
  const temp = +(24 + Math.random() * 4).toFixed(1);      // 24.0°C - 28.0°C
  const hum = +(50 + Math.random() * 20).toFixed(1);       // 50% - 70%
  const lux = Math.floor(350 + Math.random() * 250);       // 350 - 600 Lux
  const co2 = Math.floor(380 + Math.random() * 120);       // 380 - 500 ppm

  return {
    room_id: ROOM_ID,
    node_id: nodeId,
    temperature: temp,
    humidity: hum,
    pressure_hpa: 1012.5,
    light_lux: lux,
    air_quality_ppm: co2,
    status: 'VALID',
    ble_rssi: -55,
    timestamp: now
  };
}

function sendTelemetryBatch() {
  const selectedNode = NODES[Math.floor(Math.random() * NODES.length)];
  const payload = generatePayload(selectedNode);
  const topic = `classroom/${ROOM_ID}/sensor/${selectedNode}/telemetry`;

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Lỗi gửi dữ liệu [${selectedNode}]:`, err.message);
    } else {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      console.log(`[${timeStr}] ✅ Đã bắn dữ liệu Node ${selectedNode} -> Topic: ${topic}`);
      console.table([{
        'Node': selectedNode,
        'Nhiệt độ': `${payload.temperature} °C`,
        'Độ ẩm': `${payload.humidity} %`,
        'Ánh sáng': `${payload.light_lux} Lux`,
        'CO2': `${payload.air_quality_ppm} ppm`,
        'Trạng thái': payload.status
      }]);
    }
  });
}

client.on('connect', () => {
  console.log('🟢 Đã kết nối thành công tới MQTT Broker!\n');

  const isLoop = process.argv.includes('--loop');

  if (isLoop) {
    console.log('🔄 Đang chạy chế độ tự động gửi liên tục (mỗi 5 giây)...\n(Nhấn Ctrl + C để dừng)\n');
    sendTelemetryBatch();
    setInterval(sendTelemetryBatch, 5000);
  } else {
    sendTelemetryBatch();
    setTimeout(() => {
      console.log('🎉 Hoàn tất gửi dữ liệu! Hãy kiểm tra trên Dashboard Web.');
      client.end();
      process.exit(0);
    }, 1000);
  }
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT Broker:', err.message);
});
