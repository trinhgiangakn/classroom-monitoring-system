import assert from 'node:assert/strict'
import test from 'node:test'
import { Dev2Jobs } from '../../src/dev2/jobs.js'

test('offline watchdog uses the SRS 15-second cutoff and publishes node:status', async () => {
  let cutoff
  const published = []
  const jobs = new Dev2Jobs({
    repository: {},
    service: {
      markOfflineNodes: async (value) => {
        cutoff = value
        return [{
          roomId: 'P.101',
          nodeId: 'NODE-NW',
          payload: { event: 'node:status', data: { status: 'Offline' } },
        }]
      },
      markOfflineGateways: async () => [],
    },
    publish: async (...args) => published.push(args),
    now: () => new Date('2026-07-25T00:00:00Z'),
  })

  await jobs.runOfflineWatchdog()
  assert.equal(cutoff.toISOString(), '2026-07-24T23:59:45.000Z')
  assert.equal(published[0][0].event, 'node:status')
})

test('offline watchdog forwards the full room status set to Safe Mode', async () => {
  const inputs = []
  const jobs = new Dev2Jobs({
    repository: {},
    service: {
      markOfflineNodes: async () => [{
        roomId: 'P.101',
        nodeId: 'NODE-NW',
        payload: { event: 'node:status', data: { status: 'Offline' } },
      }],
      nodeStatuses: async () => [
        { roomId: 'P.101', nodeId: 'NODE-NW', status: 'OFFLINE' },
        { roomId: 'P.101', nodeId: 'NODE-NE', status: 'ONLINE' },
      ],
      markOfflineGateways: async () => [],
    },
    publish: async () => {},
    onNodeStatusesChanged: async (input) => inputs.push(input),
  })

  await jobs.runOfflineWatchdog()
  assert.equal(inputs.length, 1)
  assert.equal(inputs[0].statuses.length, 2)
})

test('offline watchdog marks a stale Gateway offline after 30 seconds', async () => {
  let gatewayCutoff
  const published = []
  const monitoringInputs = []
  const jobs = new Dev2Jobs({
    repository: {},
    service: {
      markOfflineNodes: async () => [],
      markOfflineGateways: async (value) => {
        gatewayCutoff = value
        return [{
          roomId: 'P.101',
          gateway: {
            gatewayId: 'GW-P101-01', status: 'OFFLINE',
            wifiConnected: false, mqttConnected: false,
          },
          payload: { event: 'gateway:status', data: { status: 'Offline' } },
        }]
      },
    },
    publish: async (...args) => published.push(args),
    onGatewayStatusChanged: async (input) => monitoringInputs.push(input),
    now: () => new Date('2026-07-25T00:00:00Z'),
  })

  await jobs.runOfflineWatchdog()

  assert.equal(gatewayCutoff.toISOString(), '2026-07-24T23:59:30.000Z')
  assert.equal(published[0][0].event, 'gateway:status')
  assert.equal(monitoringInputs[0].gateway.status, 'OFFLINE')
})
