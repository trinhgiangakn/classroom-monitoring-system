const test = require('node:test');
const assert = require('node:assert/strict');
const { COMPARISON, RULE_ACTION } = require('../automation.constants');
const { evaluateRule, evaluateWeatherAdvisory } = require('../rule-evaluator');

const rule = {
  id: 'RULE_FAN', roomId: 'P.101', deviceId: 'RELAY_2', sensor: 'temperature', enabled: true,
  minValidNodes: 2, delayMs: 10_000,
  activation: { comparison: COMPARISON.GT, threshold: 30, action: RULE_ACTION.TURN_ON },
  deactivation: { comparison: COMPARISON.LTE, threshold: 28, action: RULE_ACTION.TURN_OFF },
};
const telemetry = { roomId: 'P.101', nodeId: 'NODE-NW', temperature: 31, receivedAt: new Date('2026-08-09T10:00:00Z') };

test('starts delay timer before issuing an automation action', () => {
  const now = new Date('2026-08-09T10:00:00Z');
  const result = evaluateRule(rule, telemetry, { isActive: false }, now);
  assert.equal(result.decision, 'HOLD');
  assert.equal(result.nextState.candidateDecision, 'ACTIVATE');
});

test('issues TURN_ON after telemetry condition remains true for delay period', () => {
  const startedAt = new Date('2026-08-09T10:00:00Z');
  const now = new Date('2026-08-09T10:00:10Z');
  const result = evaluateRule(rule, telemetry, { isActive: false, candidateDecision: 'ACTIVATE', candidateSince: startedAt }, now);
  assert.equal(result.decision, 'ACTIVATE');
  assert.equal(result.action, RULE_ACTION.TURN_ON);
  assert.equal(result.nextState.isActive, true);
});

test('holds active device inside hysteresis band', () => {
  const result = evaluateRule(rule, { ...telemetry, temperature: 29 }, { isActive: true }, new Date());
  assert.equal(result.decision, 'HOLD');
});

test('matches an advisory only when the configured outdoor weather threshold is met', () => {
  const result = evaluateWeatherAdvisory(
    {
      ...rule,
      weatherAdvisory: {
        field: 'temperatureC',
        comparison: COMPARISON.GTE,
        threshold: 34,
        severity: 'INFO',
        message: 'Outdoor heat advisory',
      },
    },
    { temperatureC: 34.2, fetchedAt: new Date('2026-08-11T10:05:00Z') },
  );

  assert.equal(result.matches, true);
  assert.equal(result.message, 'Outdoor heat advisory');
});
