const test = require('node:test');
const assert = require('node:assert/strict');
const { AutomationService } = require('../automation.service');
const { SAFE_MODE_STATE } = require('../safe-mode.service');

function createService() {
  const createdAlerts = [];
  const published = [];
  const commands = [];
  const service = new AutomationService({
    alerts: {
      create: async (input) => {
        createdAlerts.push(input);
        return { id: `ALERT-${createdAlerts.length}`, ...input, status: 'NEW' };
      },
    },
    realtime: { publishToRoom: (roomId, message) => published.push({ roomId, ...message }) },
    deviceCommands: { dispatch: async (command) => { commands.push(command); return { commandId: 'CMD-001', status: 'PENDING' }; } },
  });
  return { service, createdAlerts, published, commands };
}

test('keeps Safe Mode state isolated by room', async () => {
  const { service } = createService();
  await service.handleNodeStatuses('P.101', [
    { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-NE', status: 'OFFLINE' },
  ]);

  assert.equal(service.getSafeMode('P.101'), SAFE_MODE_STATE.SAFE_MODE);
  assert.equal(service.getSafeMode('P.102'), SAFE_MODE_STATE.NORMAL);
});

test('creates an alert only for FAILED or TIMEOUT command results', async () => {
  const { service, createdAlerts, published } = createService();
  const success = await service.handleDeviceCommandResult({
    roomId: 'P.101', commandId: 'CMD-OK', deviceId: 'FAN_01', status: 'SUCCESS', source: 'AUTO',
  });
  const failure = await service.handleDeviceCommandResult({
    roomId: 'P.101', commandId: 'CMD-FAIL', deviceId: 'FAN_01', action: 'TURN_ON', status: 'TIMEOUT', source: 'AUTO', executionTimeMs: 0,
  });

  assert.equal(success, undefined);
  assert.equal(failure.status, 'NEW');
  assert.equal(failure.severity, 'WARNING');
  assert.equal(createdAlerts.length, 1);
  assert.equal(published.length, 1);
  assert.equal(published[0].event, 'alert:new');
});

test('dispatches an AUTO command through the DEV 3 port after a rule delay', async () => {
  const { service, commands, published } = createService();
  const now = new Date('2026-08-10T10:00:10.000Z');
  const rule = {
    id: 'RULE-FAN',
    roomId: 'P.101',
    deviceId: 'FAN_01',
    sensor: 'temperature',
    enabled: true,
    minValidNodes: 2,
    delayMs: 10_000,
    activation: { comparison: 'GT', threshold: 30, action: 'TURN_ON' },
    deactivation: { comparison: 'LTE', threshold: 28, action: 'TURN_OFF' },
  };

  service.runtimeStates.set(rule.id, {
    isActive: false,
    candidateDecision: 'ACTIVATE',
    candidateSince: new Date('2026-08-10T10:00:00.000Z'),
  });

  const result = await service.handleTelemetry({
    roomId: 'P.101',
    operationMode: 'AUTO',
    rule,
    telemetry: { temperature: 31 },
    validNodeCount: 4,
    now,
  });

  assert.equal(commands.length, 1);
  assert.equal(commands[0].source, 'AUTO');
  assert.equal(result.commandId, 'CMD-001');
  assert.equal(published[0].event, 'automation:action');
});

test('enforces safe device states (Fan ON, Humidifier/Light OFF, Curtain STOP) when Safe Mode activates', async () => {
  const { service, commands } = createService();
  await service.handleNodeStatuses('P.101', [
    { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-NE', status: 'OFFLINE' },
  ]);

  assert.equal(service.getSafeMode('P.101'), SAFE_MODE_STATE.SAFE_MODE);
  assert.equal(commands.length, 4);
  assert.deepEqual(
    commands.map(c => ({ deviceId: c.deviceId, action: c.action, source: c.source })),
    [
      { deviceId: 'FAN_01', action: 'TURN_ON', source: 'SAFE_MODE' },
      { deviceId: 'HUMIDIFIER_01', action: 'TURN_OFF', source: 'SAFE_MODE' },
      { deviceId: 'LIGHT_01', action: 'TURN_OFF', source: 'SAFE_MODE' },
      { deviceId: 'CURTAIN_01', action: 'STOP', source: 'SAFE_MODE' },
    ]
  );
});

test('activates Safe Mode and enforces safety commands when ESP32 Gateway becomes OFFLINE', async () => {
  const { service, commands } = createService();
  await service.handleGatewayStatus('P.101', 'OFFLINE');

  assert.equal(service.getSafeMode('P.101'), SAFE_MODE_STATE.SAFE_MODE);
  assert.equal(commands.length, 4);
  assert.equal(commands[0].deviceId, 'FAN_01');
  assert.equal(commands[0].action, 'TURN_ON');
  assert.equal(commands[1].deviceId, 'HUMIDIFIER_01');
  assert.equal(commands[1].action, 'TURN_OFF');
});

