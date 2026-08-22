import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildHistorySeries,
  buildSensorUpdateEvent,
  formatLatestRow,
  formatNodeDetail,
  formatRelativeSeconds,
  toCsv,
} from '../../src/dev2/formatters.js'

test('formats GET /api/sensors/latest exactly as the API specification', () => {
  assert.deepEqual(formatLatestRow({
    node_id: 'NODE-NW',
    temperature: '28.200',
    humidity: '58.000',
    pressure_hpa: '1008.000',
    light_lux: '420.000',
    air_quality_ppm: '75.000',
    air_quality_status: 'NORMAL',
    status: 'VALID',
    timestamp: new Date('2026-07-24T22:34:55Z'),
  }), {
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    pressure_hpa: 1008,
    light_lux: 420,
    air_quality_ppm: 75,
    air_quality_status: 'Bình thường',
    status: 'Hợp lệ',
    timestamp: '2026-07-24T22:34:55.000Z',
  })
})

test('formats sensor:update with the documented event envelope', () => {
  const event = buildSensorUpdateEvent({
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    light_lux: 420,
    air_quality_status: 'NORMAL',
    status: 'VALID',
    timestamp: new Date('2026-07-24T15:34:55Z'),
  }, 'Asia/Bangkok')

  assert.deepEqual(event, {
    event: 'sensor:update',
    data: {
      time: '22:34:55',
      node_id: 'NODE-NW',
      temperature: 28.2,
      humidity: 58,
      light_lux: 420,
      air_quality: 'Bình thường',
      status: 'Hợp lệ',
    },
  })
})

test('builds the documented history series keys', () => {
  const series = buildHistorySeries([{
    timestamp: new Date('2026-07-24T22:00:00Z'),
    temperature: '28.2',
    humidity: '58',
    pressure_hpa: '1008',
    light_lux: '420',
    air_quality_ppm: '75',
  }])
  assert.deepEqual(Object.keys(series), ['temperature', 'humidity', 'pressure', 'light', 'air_quality'])
  assert.equal(series.temperature[0].value, 28.2)
})

test('CSV is UTF-8 BOM prefixed and uses API field names', () => {
  const csv = toCsv([{
    timestamp: new Date('2026-07-24T22:34:55Z'),
    node_id: 'NODE-NW',
    temperature: 28.2,
    humidity: 58,
    pressure_hpa: 1008,
    light_lux: 420,
    air_quality_ppm: 75,
    air_quality_status: 'NORMAL',
    status: 'VALID',
  }])
  assert.ok(csv.startsWith('\uFEFFtimestamp,node_id,temperature'))
  assert.match(csv, /Bình thường,Hợp lệ/)
})

test('node detail keeps node status separate from telemetry validity', () => {
  const detail = formatNodeDetail({
    node_id: 'NODE-NE',
    node_status: 'WEAK_SIGNAL',
    sensor_health: 'OK',
    rssi: -81,
    packet_success_rate: 96.8,
    last_seen_at: new Date('2026-07-24T23:59:56Z'),
    node_name: 'Node Đông Bắc',
    mac_address: '00:18:E4:40:00:02',
    position: 'Góc Đông Bắc',
    firmware_version: '1.0.0',
    battery_percent: null,
    gateway_id: 'GW-P101-01',
    temperature: 28.5,
    humidity: 59,
    light_lux: 405,
    air_quality_status: 'NORMAL',
    telemetry_status: 'VALID',
    timestamp: new Date('2026-07-24T23:59:56Z'),
  }, new Date('2026-07-25T00:00:00Z'))

  assert.equal(detail.status, 'Tín hiệu yếu')
  assert.equal(detail.latest_telemetry.status, 'Hợp lệ')
})

test('future liveness timestamps are reported as invalid instead of zero seconds', () => {
  assert.equal(
    formatRelativeSeconds(
      new Date('2026-07-25T07:00:00Z'),
      new Date('2026-07-25T00:00:00Z'),
    ),
    'Thời gian không hợp lệ',
  )
})
