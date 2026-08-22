/**
 * Smart Classroom - MQTT Telemetry Simulator Script
 *
 * Chạy:
 *   node send-telemetry.js --loop
 * -> Tự động xoay vòng 4 Node (NODE-NW, NODE-NE, NODE-SW, NODE-SE)
 * -> Sinh dữ liệu ngẫu nhiên thực tế mỗi 5 giây
 */

let mqtt;
try {
  mqtt = require('./backend/node_modules/mqtt');
} catch {
  try {
    mqtt = require('d:/Projects/classroom-monitoring-system/backend/node_modules/mqtt');
  } catch {
    mqtt = require('mqtt');
  }
}

let dotenv;
try {
  dotenv = require('./backend/node_modules/dotenv');
} catch {
  try {
    dotenv = require('dotenv');
  } catch {
    dotenv = null;
  }
}
if (dotenv) {
  dotenv.config({ path: require('path').resolve(__dirname, '.env'), quiet: true });
} else {
  const fs = require('fs');
  const envPath = require('path').resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]?.trim().replace(/^['"]|['"]$/g, '') || '';
      }
    }
  }
}

const BROKER_URL = process.env.MQTT_URL || process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const ROOM_ID = 'P.101';
const NODES = ['NODE-NW', 'NODE-NE', 'NODE-SW', 'NODE-SE'];

let nodeIndex = 0;
const client = mqtt.connect(BROKER_URL);

console.log('\n======================================================================');
console.log('📡 SMART CLASSROOM - BỘ MÔ PHỎNG DỮ LIỆU CẢM BIẾN TỰ ĐỘNG (5 GIÂY/LẦN)');
console.log(`🔗 Broker: ${BROKER_URL} | Phòng học: ${ROOM_ID}`);
console.log('======================================================================\n');

function getRandomTelemetry(nodeId) {
  const now = Math.floor(Date.now() / 1000);
  const temp = +(25.0 + Math.random() * 5.0).toFixed(1);    // 25.0°C - 30.0°C
  const hum = +(50.0 + Math.random() * 25.0).toFixed(1);    // 50.0% - 75.0%
  const press = +(1008.0 + Math.random() * 6.0).toFixed(1); // 1008.0 - 1014.0 hPa
  const lux = Math.floor(320 + Math.random() * 350);        // 320 - 670 Lux
  // Chỉ số tương đối MQ135 theo contract backend: <= 100 là bình thường.
  const airQuality = Math.floor(50 + Math.random() * 45);    // 50 - 94
  const rssi = Math.floor(-65 + Math.random() * 20);        // -65 đến -45 dBm

  return {
    room_id: ROOM_ID,
    node_id: nodeId,
    temperature: temp,
    humidity: hum,
    pressure_hpa: press,
    light_lux: lux,
    air_quality_ppm: airQuality,
    status: 'VALID',
    ble_rssi: rssi,
    timestamp: now
  };
}

function sendNextTelemetry() {
  const currentNode = NODES[nodeIndex % NODES.length];
  nodeIndex++;

  const payload = getRandomTelemetry(currentNode);
  const topic = `classroom/${ROOM_ID}/sensor/${currentNode}/telemetry`;

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Lỗi gửi dữ liệu [${currentNode}]:`, err.message);
    } else {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      console.log(`[${timeStr}] 🚀 Đã gửi thành công Node [${currentNode}] -> ${topic}`);
      console.table([{
        'Thời gian': timeStr,
        'Phòng': ROOM_ID,
        'Node Cảm Biến': currentNode,
        'Nhiệt độ': `${payload.temperature} °C`,
        'Độ ẩm': `${payload.humidity} %`,
        'Áp suất': `${payload.pressure_hpa} hPa`,
        'Ánh sáng': `${payload.light_lux} Lux`,
        'Chất lượng không khí (MQ135)': `${payload.air_quality_ppm} ppm`,
        'Trạng thái': 'Hợp lệ'
      }]);
    }
  });
}

client.on('connect', () => {
  console.log('🟢 Đã kết nối thành công tới MQTT Broker EMQX!\n');
  console.log('🔄 Đang tự động gửi dữ liệu ngẫu nhiên mỗi 5 giây (Nhấn Ctrl + C để dừng)...\n');

  sendNextTelemetry();
  setInterval(sendNextTelemetry, 5000);
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT Broker:', err.message);
});
