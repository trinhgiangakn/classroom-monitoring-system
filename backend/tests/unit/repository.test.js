import assert from 'node:assert/strict'
import test from 'node:test'
import { IotRepository } from '../../src/dev2/iot-repository.js'
import { SQL } from '../../src/dev2/sql.js'

test('recent telemetry uses validated literal pagination for MySQL compatibility', async () => {
  let captured
  const database = {
    execute: async (sql, parameters) => {
      captured = { sql, parameters }
      return [[]]
    },
    getConnection: async () => { throw new Error('not used') },
  }

  const repository = new IotRepository(database)
  await repository.getRecent({
    roomId: 'P.101',
    nodeId: null,
    from: new Date('2026-08-09T00:00:00Z'),
    to: new Date('2026-08-10T00:00:00Z'),
    limit: 50,
    offset: 10,
  })

  assert.match(captured.sql, /LIMIT 50 OFFSET 10$/)
  assert.equal(captured.parameters.length, 5)
})

test('gateway metrics revive an offline gateway from the live connection flags', async () => {
  let updateParameters
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parameters) => {
      if (sql === SQL.resolveGatewayForUpdate) {
        return [[{
          id: 7,
          gateway_code: 'GW-P101-01',
          gateway_status: 'OFFLINE',
          wifi_connected: 0,
          mqtt_connected: 0,
          wifi_rssi: -90,
          ip_address: '192.168.1.20',
          firmware_version: '1.0.0',
        }]]
      }
      if (sql === 'SELECT ROW_COUNT() AS row_count') return [[{ row_count: 1 }]]
      if (sql === SQL.updateGatewayStatus) {
        updateParameters = parameters
        return [{ affectedRows: 1 }]
      }
      if (sql === SQL.gatewayStatus) return [[{ gateway_id: 'GW-P101-01', status: 'ONLINE' }]]
      return [{ affectedRows: 1 }]
    },
  }
  const repository = new IotRepository({
    execute: async () => [[]],
    getConnection: async () => connection,
  })

  await repository.insertGatewayMetrics({
    roomId: 'P.101',
    gatewayId: 'GW-P101-01',
    cpuUsagePercent: 10,
    ramHeapPercent: 20,
    mqttQueuePercent: 0,
    wifiSignalDbm: -55,
    wifiConnected: true,
    mqttConnected: true,
    uptimeSeconds: 120,
    recordedAt: new Date('2026-08-17T08:00:00Z'),
  })

  assert.equal(updateParameters[0], 'ONLINE')
  assert.equal(updateParameters[1], true)
  assert.equal(updateParameters[2], true)
})

test('stale gateway watchdog marks gateway and its links offline', async () => {
  let updateParameters
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, parameters) => {
      if (sql === SQL.staleGatewaysForUpdate) {
        return [[{
          id: 9,
          room_id: 'P.101',
          gateway_id: 'GW-P101-01',
          wifi_signal_dbm: -62,
          last_seen_at: new Date('2026-08-17T07:00:00Z'),
        }]]
      }
      updateParameters = parameters
      return [{ affectedRows: 1 }]
    },
  }
  const repository = new IotRepository({
    execute: async () => [[]],
    getConnection: async () => connection,
  })

  const gateways = await repository.markStaleGatewaysOffline(new Date('2026-08-17T07:59:30Z'))

  assert.deepEqual(updateParameters, [9])
  assert.equal(gateways[0].status, 'OFFLINE')
  assert.equal(gateways[0].wifi_connected, 0)
  assert.equal(gateways[0].mqtt_connected, 0)
})

test('liveness SQL uses backend UTC receive time and rejects future timestamps', () => {
  assert.match(SQL.updateNodeFromTelemetry, /last_seen_at = UTC_TIMESTAMP\(3\)/)
  assert.match(SQL.updateNodeStatus, /last_seen_at = UTC_TIMESTAMP\(3\)/)
  assert.match(SQL.updateGatewayStatus, /last_seen_at = UTC_TIMESTAMP\(3\)/)
  assert.match(SQL.nodes, /last_seen_at > UTC_TIMESTAMP\(3\) \+ INTERVAL 60 SECOND/)
  assert.match(SQL.gatewayStatus, /BETWEEN UTC_TIMESTAMP\(3\) - INTERVAL 60 SECOND AND UTC_TIMESTAMP\(3\) \+ INTERVAL 60 SECOND/)
  assert.match(SQL.staleNodesForUpdate, /last_seen_at > UTC_TIMESTAMP\(3\) \+ INTERVAL 60 SECOND/)
  assert.match(SQL.staleGatewaysForUpdate, /last_seen_at > UTC_TIMESTAMP\(3\) \+ INTERVAL 60 SECOND/)
})
