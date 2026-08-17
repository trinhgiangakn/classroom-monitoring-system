import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { DeviceCommandError, DeviceCommandService } = require('../../src/services/deviceCommandService');

function createService({ device = { device_id: 'LIGHT_01', operation_mode: 'MANUAL', name: 'Den chieu' }, published = true } = {}) {
  const events = [];
  const app = {
    get: (key) => key === 'realtime'
      ? { publishToRoom: (roomId, payload) => events.push({ roomId, ...payload }) }
      : undefined,
  };
  const persisted = [];
  const devices = {
    getDeviceById: async () => device,
    createCommand: async (input) => persisted.push(input),
    getCommandById: async (id) => ({ command_id: id, action: 'TURN_ON', source: 'MANUAL', status: 'PENDING' }),
    updateCommandResult: async () => true,
    updateCommandTimeout: async () => true,
    updateActualState: async () => true,
  };
  return {
    service: new DeviceCommandService({
      app,
      devices,
      publishCommand: () => published,
      setTimer: () => ({ unref() {} }),
    }),
    persisted,
    events,
  };
}

test('dispatches a MANUAL command through the shared command service', async () => {
  const { service, persisted } = createService();
  const command = await service.dispatch({
    deviceId: 'LIGHT_01', action: 'TURN_ON', source: 'MANUAL', requestedBy: 'khanh',
  });
  assert.equal(command.status, 'PENDING');
  assert.equal(persisted[0].source, 'MANUAL');
  assert.match(command.commandId, /^CMD-/);
});

test('rejects manual commands while the room is AUTO', async () => {
  const { service } = createService({ device: { operation_mode: 'AUTO' } });
  await assert.rejects(
    () => service.dispatch({ deviceId: 'LIGHT_01', action: 'TURN_ON', source: 'MANUAL' }),
    (error) => error instanceof DeviceCommandError && error.statusCode === 403,
  );
});

test('allows an AUTO rule to dispatch while the room is AUTO', async () => {
  const { service, persisted } = createService({ device: { operation_mode: 'AUTO' } });
  await service.dispatch({ deviceId: 'LIGHT_01', action: 'TURN_ON', source: 'AUTO' });
  assert.equal(persisted[0].requestedBy, 'automation-engine');
});
