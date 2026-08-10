const test = require('node:test');
const assert = require('node:assert/strict');
const { createRealtimePublisher } = require('../realtime.publisher');

test('emits a standardized WebSocket payload to the requested room', () => {
  const emitted = [];
  const io = { to: (roomId) => ({ emit: (event, payload) => emitted.push({ roomId, event, payload }) }) };
  const realtime = createRealtimePublisher(io, () => new Date('2026-08-10T10:00:00.000Z'));

  const payload = realtime.publishToRoom('P.101', { event: 'alert:new', data: { id: 'ALERT-1' } });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].roomId, 'P.101');
  assert.equal(emitted[0].event, 'alert:new');
  assert.deepEqual(payload, {
    room_id: 'P.101',
    occurred_at: '2026-08-10T10:00:00.000Z',
    data: { id: 'ALERT-1' },
  });
});
