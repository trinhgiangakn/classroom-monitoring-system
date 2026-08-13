/**
 * Smart Classroom - MQTT Telemetry Simulator Script
 *
 * Cách sử dụng:
 * 1. Bắn 1 gói tin CỐ ĐỊNH chuẩn:
 *      node send-telemetry.js
 *
 * 2. Tự chọn thông số theo ý bạn:
 *      node send-telemetry.js --node NODE-NW --temp 28.5 --hum 62 --lux 520 --co2 395
 *
 * 3. Tự động bắn lặp lại mỗi 5 giây:
 *      node send-telemetry.js --loop
 */

const mqtt = require('./backend/node_modules/mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';
const ROOM_ID = 'P.101';

// Đọc tham số từ dòng lệnh (nếu có)
function getArg(flag, defaultValue) {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

const isLoop = process.argv.includes('--loop');
const isRandom = process.argv.includes('--random');

const targetNode = getArg('--node', 'NODE-NW');
const fixedTemp = +getArg('--temp', 28.5);
const fixedHum = +getArg('--hum', 62.0);
const fixedLux = +getArg('--lux', 520);
const fixedCo2 = +getArg('--co2', 395);

const client = mqtt.connect(BROKER_URL);

console.log('\n======================================================');
console.log('📡 SMART CLASSROOM - MQTT TELEMETRY SIMULATOR');
console.log(`🔗 Broker: ${BROKER_URL} | Phòng: ${ROOM_ID}`);
console.log('======================================================\n');

function buildPayload(nodeId) {
  const now = Math.floor(Date.now() / 1000);

  let temp = fixedTemp;
  let hum = fixedHum;
  let lux = fixedLux;
  let co2 = fixedCo2;

  if (isRandom) {
    temp = +(24 + Math.random() * 4).toFixed(1);
    hum = +(50 + Math.random() * 20).toFixed(1);
    lux = Math.floor(350 + Math.random() * 250);
    co2 = Math.floor(380 + Math.random() * 120);
  }

  return {
    room_id: ROOM_ID,
    node_id: nodeId,
    temperature: temp,
    humidity: hum,
    pressure_hpa: 1012.0,
    light_lux: lux,
    air_quality_ppm: co2,
    status: 'VALID',
    ble_rssi: -50,
    timestamp: now
  };
}

function sendTelemetry() {
  const payload = buildPayload(targetNode);
  const topic = `classroom/${ROOM_ID}/sensor/${targetNode}/telemetry`;

  client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Lỗi gửi dữ liệu [${targetNode}]:`, err.message);
    } else {
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      console.log(`[${timeStr}] ✅ Đã bắn thành công vào Topic: ${topic}`);
      console.table([{
        'Thời gian': timeStr,
        'Phòng': ROOM_ID,
        'Node Cảm Biến': targetNode,
        'Nhiệt độ': `${payload.temperature} °C`,
        'Độ ẩm': `${payload.humidity} %`,
        'Ánh sáng': `${payload.light_lux} Lux`,
        'Khí CO2 (MQ135)': `${payload.air_quality_ppm} ppm`,
        'Trạng thái': payload.status
      }]);
    }
  });
}

client.on('connect', () => {
  console.log('🟢 Đã kết nối thành công tới MQTT Broker!\n');

  if (isLoop) {
    console.log('🔄 Đang gửi dữ liệu định kỳ mỗi 5 giây (Nhấn Ctrl + C để dừng)...\n');
    sendTelemetry();
    setInterval(sendTelemetry, 5000);
  } else {
    sendTelemetry();
    setTimeout(() => {
      console.log('\n🎉 Hoàn tất gửi dữ liệu! Hãy xem bảng "Bản ghi gần đây" trên Web.\n');
      client.end();
      process.exit(0);
    }, 1000);
  }
});

client.on('error', (err) => {
  console.error('❌ Lỗi kết nối MQTT Broker:', err.message);
});
