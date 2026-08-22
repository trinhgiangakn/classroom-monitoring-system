import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createPublishWebSocket } = require('../../server.js')

test('unwraps a Dev 2 realtime envelope before publishing it to Socket.io', async () => {
  const emitted = []
  const publish = createPublishWebSocket(() => ({
    publishToRoom: (roomId, payload) => emitted.push({ roomId, payload }),
  }))

  await publish(
    { event: 'sensor:update', data: { node_id: 'NODE-NW', temperature: 31 } },
    { roomId: 'P.101', nodeId: 'NODE-NW' },
  )

  assert.deepEqual(emitted, [{
    roomId: 'P.101',
    payload: {
      event: 'sensor:update',
      data: { node_id: 'NODE-NW', temperature: 31 },
    },
  }])
  assert.equal(typeof emitted[0].payload.event, 'string')
})

test('keeps the legacy event-name and data publishing form compatible', async () => {
  const emitted = []
  const publish = createPublishWebSocket(() => ({
    publishToRoom: (roomId, payload) => emitted.push({ roomId, payload }),
  }))

  await publish('gateway:status', { room_id: 'P.101', status: 'ONLINE' })

  assert.deepEqual(emitted, [{
    roomId: 'P.101',
    payload: {
      event: 'gateway:status',
      data: { room_id: 'P.101', status: 'ONLINE' },
    },
  }])
})
