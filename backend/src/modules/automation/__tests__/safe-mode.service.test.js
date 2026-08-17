const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSafeMode, SAFE_MODE_STATE } = require('../safe-mode.service');

test('enters Safe Mode if two nodes are offline', () => {
  const statuses = [
    { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-NE', status: 'OFFLINE' },
    { roomId: 'P.101', nodeId: 'NODE-SW', status: 'ONLINE' },
  ];
  const result = evaluateSafeMode('P.101', statuses, SAFE_MODE_STATE.NORMAL);
  assert.equal(result.currentState, SAFE_MODE_STATE.SAFE_MODE);
  assert.equal(result.changed, true);
});

test('does not enter Safe Mode if only one node is offline', () => {
  const statuses = [{ roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' }];
  const result = evaluateSafeMode('P.101', statuses, SAFE_MODE_STATE.NORMAL);
  assert.equal(result.currentState, SAFE_MODE_STATE.NORMAL);
});
