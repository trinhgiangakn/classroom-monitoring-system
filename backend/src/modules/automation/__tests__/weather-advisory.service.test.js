const assert = require('node:assert/strict');
const test = require('node:test');

const { AutomationService } = require('../automation.service');
const { COMPARISON, RULE_ACTION } = require('../automation.constants');
const { REALTIME_EVENT } = require('../../realtime/realtime.events');

const rule = {
  id: 'RULE_FAN',
  roomId: 'P.101',
  deviceId: 'RELAY_2',
  enabled: true,
  sensor: 'temperature',
  minValidNodes: 2,
  delayMs: 10_000,
  activation: { comparison: COMPARISON.GTE, threshold: 30, action: RULE_ACTION.TURN_ON },
  deactivation: { comparison: COMPARISON.LTE, threshold: 28, action: RULE_ACTION.TURN_OFF },
  weatherAdvisory: {
    field: 'temperatureC',
    comparison: COMPARISON.GTE,
    threshold: 34,
    severity: 'INFO',
    message: 'Outdoor heat advisory',
  },
};

test('creates a weather advisory in MANUAL mode without dispatching a device command', async () => {
  const alerts = [];
  const events = [];
  const commands = [];
  const service = new AutomationService({
    alerts: {
      async create(input) {
        const alert = { id: `ALERT-${alerts.length + 1}`, ...input };
        alerts.push(alert);
        return alert;
      },
    },
    realtime: { publishToRoom: (roomId, payload) => events.push({ roomId, payload }) },
    deviceCommands: { dispatch: async (input) => commands.push(input) },
  });

  const result = await service.handleTelemetry({
    roomId: 'P.101',
    operationMode: 'MANUAL',
    rule,
    telemetry: { temperature: 31 },
    validNodeCount: 4,
    weather: { temperatureC: 34.2, fetchedAt: new Date('2026-08-11T10:05:00Z') },
  });

  assert.equal(result.type, 'WEATHER_ADVISORY');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, 'INFO');
  assert.equal(commands.length, 0);
  assert.equal(events[0].payload.event, REALTIME_EVENT.ALERT_NEW);
});

test('does not create a second advisory for the same rule and weather snapshot', async () => {
  const alerts = [];
  const service = new AutomationService({
    alerts: { async create(input) { alerts.push(input); return input; } },
    realtime: { publishToRoom() {} },
    deviceCommands: { dispatch: async () => assert.fail('weather advisory must not dispatch a command') },
  });
  const input = {
    roomId: 'P.101',
    operationMode: 'MANUAL',
    rule,
    telemetry: { temperature: 31 },
    validNodeCount: 4,
    weather: { temperatureC: 34.2, fetchedAt: new Date('2026-08-11T10:05:00Z') },
  };

  await service.handleTelemetry(input);
  const result = await service.handleTelemetry(input);

  assert.equal(result, undefined);
  assert.equal(alerts.length, 1);
});
