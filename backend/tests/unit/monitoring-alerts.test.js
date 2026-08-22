import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { AlertService } = require('../../src/modules/alerts/alert.service')
const { MonitoringAlertService } = require('../../src/modules/alerts/monitoring-alert.service')

function createHarness() {
  let nextId = 1
  const records = []
  const events = []
  const repository = {
    async create(input) {
      const alert = {
        id: String(nextId++),
        status: 'NEW',
        createdAt: new Date(),
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedBy: null,
        resolvedAt: null,
        ...input,
      }
      records.push(alert)
      return alert
    },
    async findOpenByCondition(roomId, conditionKey) {
      return records.findLast(alert => alert.roomId === roomId
        && alert.conditionKey === conditionKey && alert.status !== 'RESOLVED') ?? null
    },
    async save(input) {
      const index = records.findIndex(alert => alert.id === input.id)
      records[index] = { ...input }
      return records[index]
    },
  }
  const alerts = new AlertService(repository)
  const service = new MonitoringAlertService({
    alerts,
    realtime: { publishToRoom: (roomId, payload) => events.push({ roomId, ...payload }) },
  })
  return { events, records, service }
}

function telemetry(overrides = {}) {
  return {
    roomId: 'P.101',
    nodeId: 'NODE-NW',
    temperature: 28,
    humidity: 55,
    pressureHpa: 1008,
    lightLux: 450,
    airQualityPpm: 70,
    dataStatus: 'VALID',
    bleRssi: -60,
    errorFlags: null,
    ...overrides,
  }
}

test('creates one temperature alert, keeps it through hysteresis, and resolves on recovery', async () => {
  const { events, records, service } = createHarness()

  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NW', telemetry: telemetry({ temperature: 31 }) })
  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NW', telemetry: telemetry({ temperature: 31.5 }) })
  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NW', telemetry: telemetry({ temperature: 29 }) })

  const temperatureAlerts = records.filter(alert => alert.conditionKey === 'sensor:NODE-NW:temperature')
  assert.equal(temperatureAlerts.length, 1)
  assert.equal(temperatureAlerts[0].type, 'TEMPERATURE_HIGH')
  assert.equal(temperatureAlerts[0].status, 'NEW')

  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NW', telemetry: telemetry({ temperature: 28 }) })
  assert.equal(records.find(alert => alert.id === temperatureAlerts[0].id).status, 'RESOLVED')
  assert.deepEqual(events.filter(event => event.event.startsWith('alert:')).map(event => event.event), [
    'alert:new',
    'alert:updated',
  ])
})

test('escalates a warning to critical without leaving two alerts open', async () => {
  const { records, service } = createHarness()
  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NE', telemetry: telemetry({ nodeId: 'NODE-NE', temperature: 31 }) })
  await service.handleTelemetry({ roomId: 'P.101', nodeId: 'NODE-NE', telemetry: telemetry({ nodeId: 'NODE-NE', temperature: 36 }) })

  const alerts = records.filter(alert => alert.conditionKey === 'sensor:NODE-NE:temperature')
  assert.equal(alerts.length, 2)
  assert.equal(alerts[0].status, 'RESOLVED')
  assert.equal(alerts[1].type, 'TEMPERATURE_CRITICAL_HIGH')
  assert.equal(alerts[1].status, 'NEW')
})

test('creates and recovers node connectivity alerts', async () => {
  const { records, service } = createHarness()
  await service.handleNodeStatuses({
    roomId: 'P.101',
    statuses: [{ roomId: 'P.101', nodeId: 'NODE-SW', status: 'OFFLINE', rssi: -90 }],
  })
  assert.equal(records[0].type, 'NODE_OFFLINE')

  await service.handleNodeStatuses({
    roomId: 'P.101',
    statuses: [{ roomId: 'P.101', nodeId: 'NODE-SW', status: 'ONLINE', rssi: -60 }],
  })
  assert.equal(records[0].status, 'RESOLVED')
})

test('creates node battery and packet-loss alerts and resolves them after recovery', async () => {
  const { records, service } = createHarness()
  await service.handleNodeStatuses({
    roomId: 'P.101',
    statuses: [{
      roomId: 'P.101', nodeId: 'NODE-NW', status: 'ONLINE', rssi: -60,
      batteryPercent: 8, packetSuccessRate: 85,
    }],
  })

  assert.equal(records.some(alert => alert.type === 'NODE_BATTERY_CRITICAL'), true)
  assert.equal(records.some(alert => alert.type === 'NODE_PACKET_LOSS_HIGH'), true)

  await service.handleNodeStatuses({
    roomId: 'P.101',
    statuses: [{
      roomId: 'P.101', nodeId: 'NODE-NW', status: 'ONLINE', rssi: -60,
      batteryPercent: 25, packetSuccessRate: 95,
    }],
  })

  assert.equal(records.filter(alert => alert.conditionKey?.includes('NODE-NW') && alert.status !== 'RESOLVED').length, 0)
})

test('creates gateway connectivity and resource alerts', async () => {
  const { records, service } = createHarness()
  await service.handleGatewayStatus({
    roomId: 'P.101',
    gateway: {
      gatewayId: 'GW-P101-01', status: 'DEGRADED', wifiConnected: true, mqttConnected: false,
      wifiRssi: -60, cpuUsagePercent: 90, ramHeapPercent: 50, mqttQueuePercent: 20,
    },
  })

  assert.equal(records.some(alert => alert.type === 'GATEWAY_MQTT_DISCONNECTED'), true)
  assert.equal(records.some(alert => alert.type === 'GATEWAY_CPU_HIGH'), true)
})

test('creates data-quality and air-quality alerts from telemetry', async () => {
  const { records, service } = createHarness()
  await service.handleTelemetry({
    roomId: 'P.101',
    nodeId: 'NODE-SE',
    telemetry: telemetry({ nodeId: 'NODE-SE', airQualityPpm: 230, dataStatus: 'PARTIAL' }),
  })

  assert.equal(records.some(alert => alert.type === 'AIR_QUALITY_CRITICAL'), true)
  assert.equal(records.some(alert => alert.type === 'SENSOR_DATA_PARTIAL'), true)
})
