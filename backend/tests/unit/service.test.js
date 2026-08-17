import assert from 'node:assert/strict'
import test from 'node:test'
import { IotService } from '../../src/dev2/iot-service.js'

const fixedNow = () => new Date('2026-07-25T00:00:00Z')

test('latest wraps rows in the documented success/room_id/data envelope', async () => {
  const repository = {
    getLatest: async () => [{
      node_id: 'NODE-NW',
      temperature: 28.2,
      humidity: 58,
      light_lux: 420,
      air_quality_status: 'NORMAL',
      status: 'VALID',
      timestamp: new Date('2026-07-24T22:34:55Z'),
    }],
  }
  const response = await new IotService(repository, { now: fixedNow }).latest({ room_id: 'P.101' })
  assert.equal(response.success, true)
  assert.equal(response.room_id, 'P.101')
  assert.equal(response.data[0].air_quality_status, 'Bình thường')
})

test('history wraps values in the documented series envelope', async () => {
  const repository = {
    getHistory: async (options) => {
      assert.equal(options.source, 'hourly')
      return [{
        timestamp: new Date('2026-07-24T22:00:00Z'),
        temperature: 28.2,
        humidity: 58,
        light_lux: 420,
      }]
    },
  }
  const response = await new IotService(repository, { now: fixedNow }).history({
    room_id: 'P.101',
    time_range: '24h',
    node_id: 'all',
    data_type: 'all',
  })
  assert.equal(response.time_range, '24h')
  assert.deepEqual(response.series.temperature[0], {
    timestamp: '2026-07-24T22:00:00.000Z',
    value: 28.2,
  })
})

test('new telemetry emits sensor:update and uses a stable 64-char ingest key', async () => {
  let saved
  const repository = {
    insertTelemetry: async (record) => {
      saved = record
      return {
        inserted: true,
        nodeStatusChanged: false,
        node: {},
      }
    },
  }
  const service = new IotService(repository, { now: fixedNow, timeZone: 'Asia/Bangkok' })
  const result = await service.ingestTelemetry({
    room_id: 'P.101',
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    light_lux: 420,
    air_quality_ppm: 75,
    status: 'VALID',
    timestamp: 1784910895,
  }, { roomId: 'P.101', nodeId: 'NODE-NW' })

  assert.equal(saved.ingestKey.length, 64)
  assert.equal(saved.airQualityStatus, 'NORMAL')
  assert.equal(result.duplicate, false)
  assert.equal(result.events[0].payload.event, 'sensor:update')
})

test('duplicate QoS 1 telemetry does not emit sensor:update again', async () => {
  const repository = {
    insertTelemetry: async () => ({
      inserted: false,
      nodeStatusChanged: false,
      node: {},
    }),
  }
  const service = new IotService(repository, { now: fixedNow })
  const result = await service.ingestTelemetry({
    room_id: 'P.101',
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    light_lux: 420,
    air_quality_ppm: 75,
    status: 'VALID',
    timestamp: 1784910895,
  }, { roomId: 'P.101', nodeId: 'NODE-NW' })

  assert.equal(result.duplicate, true)
  assert.deepEqual(result.events, [])
})
