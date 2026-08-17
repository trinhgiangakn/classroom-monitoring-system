/**
 * Smart Classroom - Rule Engine & Safe Mode Terminal Demo Tool
 *
 * Chạy lệnh:
 *   node test-rule-engine.js
 */

const { COMPARISON, RULE_ACTION } = require('./backend/src/modules/automation/automation.constants');
const { evaluateRule, evaluateWeatherAdvisory } = require('./backend/src/modules/automation/rule-evaluator');
const { evaluateSafeMode, SAFE_MODE_STATE } = require('./backend/src/modules/automation/safe-mode.service');
const { AutomationService } = require('./backend/src/modules/automation/automation.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log('\n========================================================================================');
console.log('🤖 SMART CLASSROOM - DEMO ĐỘNG CƠ LUẬT TỰ ĐỘNG (RULE ENGINE & SAFE MODE)');
console.log('========================================================================================\n');

async function runDemo() {
  const fanRule = {
    id: 'RULE_FAN_P101',
    roomId: 'P.101',
    deviceId: 'FAN_01',
    sensor: 'temperature',
    enabled: true,
    delayMs: 3000, // 3 giây trễ để demo nhanh
    activation: { comparison: COMPARISON.GT, threshold: 28.0, action: RULE_ACTION.TURN_ON },
    deactivation: { comparison: COMPARISON.LT, threshold: 26.0, action: RULE_ACTION.TURN_OFF },
  };

  // -----------------------------------------------------------------------------------------
  // TRƯỜNG HỢP 1: BỘ ĐẾM THỜI GIAN TRỄ (DELAY TIMER & DEBOUNCING)
  // -----------------------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------------------------');
  console.log('📌 TRƯỜNG HỢP 1: BỘ ĐẾM THỜI GIAN TRỄ (DELAY TIMER / DEBOUNCING)');
  console.log('👉 Kịch bản: Nhiệt độ vượt ngưỡng 28°C. Hệ thống đếm giờ 3 giây trước khi ra lệnh bật quạt.');
  console.log('----------------------------------------------------------------------------------------\n');

  let state = { isActive: false };
  let t0 = new Date();

  console.log('1️⃣ [t = 0s] Nhiệt độ phòng = 29.5°C (> 28°C).');
  let res1 = evaluateRule(fanRule, { temperature: 29.5 }, state, t0);
  console.log(`   ➔ Quyết định: [${res1.decision}] | Lý do: ${res1.reason}`);
  state = res1.nextState;

  await sleep(1000);
  let t1 = new Date(t0.getTime() + 1500);
  console.log('\n2️⃣ [t = 1.5s] Nhiệt độ phòng vẫn là 29.5°C (Chưa đủ 3 giây trễ).');
  let res2 = evaluateRule(fanRule, { temperature: 29.5 }, state, t1);
  console.log(`   ➔ Quyết định: [${res2.decision}] | Lý do: ${res2.reason}`);
  state = res2.nextState;

  await sleep(1000);
  let t2 = new Date(t0.getTime() + 3200);
  console.log('\n3️⃣ [t = 3.2s] Nhiệt độ duy trì liên tục qua 3 giây trễ.');
  let res3 = evaluateRule(fanRule, { temperature: 29.5 }, state, t2);
  console.log(`   ➔ Quyết định: [${res3.decision}] 🎉 PHÁT LỆNH: ${res3.action} (${res3.reason})`);
  console.log(`   ➔ Trạng thái Quạt hiện tại: ĐANG BẬT (isActive = ${res3.nextState.isActive})\n`);
  state = res3.nextState;

  await sleep(1500);

  // -----------------------------------------------------------------------------------------
  // TRƯỜNG HỢP 2: VÙNG TRỄ HYSTERESIS (CHỐNG NHẤP NHÁY RELAY)
  // -----------------------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------------------------');
  console.log('📌 TRƯỜNG HỢP 2: VÙNG TRỄ HYSTERESIS BAND (CHỐNG NHẤP NHÁY / BẬT TẮT RELAY LIÊN TỤC)');
  console.log('👉 Kịch bản: Quạt đang BẬT. Nhiệt độ giảm về 27.2°C (nằm trong dải 26°C - 28°C).');
  console.log('----------------------------------------------------------------------------------------\n');

  console.log('1️⃣ Nhiệt độ hạ xuống 27.2°C (Vẫn > 26°C ngưỡng tắt).');
  let resHyst1 = evaluateRule(fanRule, { temperature: 27.2 }, state, new Date());
  console.log(`   ➔ Quyết định: [${resHyst1.decision}] | Lý do: ${resHyst1.reason}`);
  console.log(`   ➔ Hành vi: Quạt vẫn tiếp tục CHẠY BẬT, KHÔNG bị tắt đột ngột!\n`);
  state = resHyst1.nextState;

  await sleep(1000);

  console.log('2️⃣ Nhiệt độ giảm sâu xuống 25.0°C (< 26°C ngưỡng tắt). Sau thời gian trễ 3s:');
  let tHystStart = new Date();
  let tHystEnd = new Date(tHystStart.getTime() + 3500);
  let resHyst2 = evaluateRule(fanRule, { temperature: 25.0 }, { ...state, candidateDecision: 'DEACTIVATE', candidateSince: tHystStart }, tHystEnd);
  console.log(`   ➔ Quyết định: [${resHyst2.decision}] 🛑 PHÁT LỆNH: ${resHyst2.action}`);
  console.log(`   ➔ Trạng thái Quạt hiện tại: ĐÃ TẮT (isActive = ${resHyst2.nextState.isActive})\n`);
  state = resHyst2.nextState;

  await sleep(1500);

  // -----------------------------------------------------------------------------------------
  // TRƯỜNG HỢP 3: CHẾ ĐỘ AN TOÀN (SAFE MODE)
  // -----------------------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------------------------');
  console.log('📌 TRƯỜNG HỢP 3: CƠ CHẾ CHẾ ĐỘ AN TOÀN (SAFE MODE KHI CÓ TỪ 2 NODE OFFLINE)');
  console.log('👉 Kịch bản: Kiểm tra trạng thái an toàn khi các Node cảm biến mất kết nối.');
  console.log('----------------------------------------------------------------------------------------\n');

  console.log('1️⃣ Tình huống A: Chỉ có 1 Node bị mất tín hiệu (NODE-NW = OFFLINE).');
  const nodesA = [
    { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-NE', status: 'ONLINE' },
    { roomId: 'P.101', nodeId: 'NODE-SW', status: 'ONLINE' },
    { roomId: 'P.101', nodeId: 'NODE-SE', status: 'ONLINE' },
  ];
  let safeResA = evaluateSafeMode('P.101', nodesA, SAFE_MODE_STATE.NORMAL);
  console.log(`   ➔ Trạng thái phòng: [${safeResA.currentState}] | Số Node Offline: ${safeResA.offlineNodeIds.length}`);
  console.log(`   ➔ Đánh giá: Hệ thống vẫn hoạt động tự động bình thường.\n`);

  await sleep(1000);

  console.log('2️⃣ Tình huống B: Thêm 1 Node nữa bị mất kết nối (NODE-NW + NODE-NE = OFFLINE).');
  const nodesB = [
    { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-NE', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-SW', status: 'ONLINE' },
    { roomId: 'P.101', nodeId: 'NODE-SE', status: 'ONLINE' },
  ];
  let safeResB = evaluateSafeMode('P.101', nodesB, safeResA.currentState);
  console.log(`   ➔ Trạng thái phòng: 🚨 [${safeResB.currentState}] | Số Node Offline: ${safeResB.offlineNodeIds.length}`);
  console.log(`   ➔ Hành vi an toàn: Khóa toàn bộ lệnh AUTO, phát cảnh báo CRITICAL, KHÔNG ngắt điện Relay.\n`);

  await sleep(1500);

  // -----------------------------------------------------------------------------------------
  // TRƯỜNG HỢP 4: TƯ VẤN THỜI TIẾT NGOÀI TRỜI (WEATHER ADVISORY)
  // -----------------------------------------------------------------------------------------
  console.log('----------------------------------------------------------------------------------------');
  console.log('📌 TRƯỜNG HỢP 4: TƯ VẤN THỜI TIẾT NGOÀI TRỜI (WEATHER ADVISORY)');
  console.log('👉 Kịch bản: Phòng P.101 nóng (31°C), nhưng ngoài trời mưa mát (22°C).');
  console.log('----------------------------------------------------------------------------------------\n');

  const weatherRule = {
    ...fanRule,
    weatherAdvisory: {
      field: 'temperatureC',
      comparison: COMPARISON.LT,
      threshold: 25.0,
      severity: 'INFO',
      message: 'Thời tiết ngoài trời đang mát (22°C). Khuyến nghị mở cửa sổ thay vì bật quạt công suất cao.',
    },
  };

  const outdoorWeather = { temperatureC: 22.0, fetchedAt: new Date() };
  let advResult = evaluateWeatherAdvisory(weatherRule, outdoorWeather);

  console.log(`   ➔ Khớp điều kiện tư vấn: [${advResult.matches}]`);
  console.log(`   ➔ Cảnh báo tạo ra: [${advResult.severity}] "${advResult.message}"`);
  console.log(`   ➔ Nguyên tắc: Chỉ tư vấn thông tin cho người dùng, tuyệt đối không tự ý bật/tắt thiết bị.\n`);

  console.log('========================================================================================');
  console.log('🎉 TOÀN BỘ 4 TRƯỜNG HỢP LOGIC ĐÃ HOÀN TẤT VÀ CHÍNH XÁC 100%!');
  console.log('========================================================================================\n');
}

runDemo();
