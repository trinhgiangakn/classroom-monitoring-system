import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseHistoryQuery,
  parseTelemetryPayload,
} from '../../src/dev2/validation.js'

test('parses the documented telemetry JSON and Unix timestamp', () => {
  const payload = parseTelemetryPayload({
    room_id: 'P.101',
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    light_lux: 420,
    air_quality_ppm: 75,
    status: 'VALID',
    timestamp: 1784910895,
  }, { roomId: 'P.101', nodeId: 'NODE-NW' })

  assert.equal(payload.roomId, 'P.101')
  assert.equal(payload.nodeId, 'NODE-NW')
  assert.equal(payload.sampledAt.toISOString(), '2026-07-24T16:34:55.000Z')
})

test('rejects telemetry whose identity differs from the MQTT topic', () => {
  assert.throws(() => parseTelemetryPayload({
    room_id: 'P.102',
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    light_lux: 420,
    air_quality_ppm: 75,
    status: 'VALID',
    timestamp: 1784910895,
  }, { roomId: 'P.101', nodeId: 'NODE-NW' }), /room_id does not match/)
})

test('uses hourly downsampling for the documented 24h history query', () => {
  const query = parseHistoryQuery({
    room_id: 'P.101',
    time_range: '24h',
    node_id: 'all',
    data_type: 'all',
  }, { now: new Date('2026-07-25T00:00:00Z') })

  assert.equal(query.source, 'hourly')
  assert.equal(query.nodeId, null)
  assert.equal(query.from.toISOString(), '2026-07-24T00:00:00.000Z')
})
