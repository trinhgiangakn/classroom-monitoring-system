import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { AutomationRuntime } = require('../../src/modules/automation/automation-runtime');

test('loads room context and enabled rules before evaluating persisted telemetry', async () => {
  const calls = [];
  const runtime = new AutomationRuntime({
    repository: {
      getRuntimeContext: async () => ({ operationMode: 'AUTO', validNodeCount: 4 }),
      listEnabledRules: async () => [{ id: 'RULE-1' }, { id: 'RULE-2' }],
    },
    automationService: {
      handleTelemetry: async (input) => {
        calls.push(input);
        return input.rule.id === 'RULE-1' ? { commandId: 'CMD-1' } : undefined;
      },
    },
  });

  const result = await runtime.handleTelemetry({
    roomId: 'P.101', telemetry: { temperature: 31 },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].operationMode, 'AUTO');
  assert.equal(calls[0].validNodeCount, 4);
  assert.deepEqual(result, [{ commandId: 'CMD-1' }]);
});

test('forwards fresh weather context without letting a weather lookup failure stop automation', async () => {
  const calls = [];
  const warnings = [];
  const runtime = new AutomationRuntime({
    repository: {
      getRuntimeContext: async () => ({ operationMode: 'AUTO', validNodeCount: 4 }),
      listEnabledRules: async () => [{ id: 'RULE-1' }],
    },
    weatherContext: {
      getFreshLatest: async () => {
        throw new Error('Open-Meteo temporarily unavailable');
      },
    },
    logger: { warn: (message) => warnings.push(message) },
    automationService: {
      handleTelemetry: async (input) => {
        calls.push(input);
        return { commandId: 'CMD-1' };
      },
    },
  });

  const result = await runtime.handleTelemetry({
    roomId: 'P.101', telemetry: { temperature: 31 },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].weather, undefined);
  assert.deepEqual(result, [{ commandId: 'CMD-1' }]);
  assert.equal(warnings.length, 1);
});
