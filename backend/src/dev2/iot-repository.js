import { NotFoundError } from './errors.js'
import { SQL } from './sql.js'

function changed(left, right) {
  return String(left ?? '') !== String(right ?? '')
}

function booleanChanged(left, right) {
  return Boolean(left) !== Boolean(right)
}

async function withTransaction(database, operation) {
  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()
    const result = await operation(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function firstRow(executor, sql, parameters) {
  const [rows] = await executor.execute(sql, parameters)
  return rows[0] ?? null
}

export class IotRepository {
  constructor(database) {
    if (!database?.execute || !database?.getConnection) {
      throw new TypeError('database must provide execute() and getConnection()')
    }
    this.database = database
  }

  async getLatest(roomId) {
    const [rows] = await this.database.execute(SQL.latestSensors, [roomId])
    return rows
  }

  async getHistory({ roomId, nodeId, from, to, source }) {
    const sql = source === 'daily'
      ? SQL.historyDaily
      : source === 'hourly'
        ? SQL.historyHourly
        : SQL.historyRaw
    const [rows] = await this.database.execute(sql, [roomId, from, to, nodeId, nodeId])
    return rows
  }

  async getRecent({ roomId, nodeId, from, to, limit, offset }) {
    const pagination = `LIMIT ${Math.trunc(limit)} OFFSET ${Math.trunc(offset)}`
    const [rows] = await this.database.execute(`${SQL.recentSensors}\n${pagination}`, [
      roomId,
      nodeId,
      nodeId,
      from,
      to,
    ])
    return rows
  }

  async getExportRows({ roomId, nodeId, from, to }) {
    const [rows] = await this.database.execute(SQL.exportSensors, [
      roomId,
      nodeId,
      nodeId,
      from,
      to,
    ])
    return rows
  }

  async getNodes(roomId) {
    const [rows] = await this.database.execute(SQL.nodes, [roomId])
    return rows
  }

  async getNode(roomId, nodeId) {
    return firstRow(this.database, SQL.nodeDetail, [roomId, nodeId])
  }

  async getGatewayStatus(roomId, gatewayId = null) {
    const [rows] = await this.database.execute(SQL.gatewayStatus, [roomId, gatewayId, gatewayId])
    return rows
  }

  async insertTelemetry(sample) {
    return withTransaction(this.database, async (connection) => {
      const node = await firstRow(connection, SQL.resolveNodeForUpdate, [sample.roomId, sample.nodeId])
      if (!node) {
        throw new NotFoundError('Sensor node was not found', {
          room_id: sample.roomId,
          node_id: sample.nodeId,
        })
      }

      await connection.execute(SQL.insertTelemetry, [
        node.id,
        node.gateway_id,
        sample.ingestKey,
        sample.temperature,
        sample.humidity,
        sample.pressureHpa,
        sample.lightLux,
        sample.airQualityPpm,
        sample.airQualityStatus,
        sample.dataStatus,
        sample.errorFlags === null ? null : JSON.stringify(sample.errorFlags),
        sample.bleRssi,
        sample.sampledAt,
      ])
      const rowCount = await firstRow(connection, 'SELECT ROW_COUNT() AS row_count', [])

      await connection.execute(SQL.updateNodeFromTelemetry, [
        sample.nodeStatus,
        sample.sensorHealth,
        sample.bleRssi,
        node.id,
      ])

      return {
        inserted: Number(rowCount.row_count) === 1,
        nodeStatusChanged:
          changed(node.node_status, sample.nodeStatus)
          || changed(node.sensor_health, sample.sensorHealth)
          || (sample.bleRssi !== null && changed(node.signal_rssi, sample.bleRssi)),
        node: {
          node_id: sample.nodeId,
          status: sample.nodeStatus,
          sensor_health: sample.sensorHealth,
          rssi: sample.bleRssi ?? node.signal_rssi,
          packet_success_rate: node.packet_success_rate,
          last_seen_at: sample.sampledAt,
        },
      }
    })
  }

  async updateNodeStatus(status) {
    return withTransaction(this.database, async (connection) => {
      const node = await firstRow(connection, SQL.resolveNodeForUpdate, [status.roomId, status.nodeId])
      if (!node) {
        throw new NotFoundError('Sensor node was not found', {
          room_id: status.roomId,
          node_id: status.nodeId,
        })
      }

      const statusChanged =
        changed(node.node_status, status.status)
        || changed(node.sensor_health, status.sensorHealth)
        || (status.rssi !== null && changed(node.signal_rssi, status.rssi))
        || (status.packetSuccessRate !== null && changed(node.packet_success_rate, status.packetSuccessRate))
        || (status.batteryPercent !== null && changed(node.battery_percent, status.batteryPercent))

      await connection.execute(SQL.updateNodeStatus, [
        status.status,
        status.sensorHealth,
        status.rssi,
        status.packetSuccessRate,
        status.batteryPercent,
        node.id,
      ])

      return {
        changed: statusChanged,
        node: {
          node_id: status.nodeId,
          status: status.status,
          sensor_health: status.sensorHealth,
          rssi: status.rssi ?? node.signal_rssi,
          packet_success_rate: status.packetSuccessRate ?? node.packet_success_rate,
          last_seen_at: status.lastSeenAt,
        },
      }
    })
  }

  async updateGatewayStatus(status) {
    return withTransaction(this.database, async (connection) => {
      const gateway = await firstRow(connection, SQL.resolveGatewayForUpdate, [
        status.roomId,
        status.gatewayId,
        status.gatewayId,
      ])
      if (!gateway) {
        throw new NotFoundError('Gateway was not found', {
          room_id: status.roomId,
          gateway_id: status.gatewayId,
        })
      }

      const statusChanged =
        changed(gateway.gateway_status, status.status)
        || booleanChanged(gateway.wifi_connected, status.wifiConnected)
        || booleanChanged(gateway.mqtt_connected, status.mqttConnected)
        || changed(gateway.wifi_rssi, status.wifiRssi)

      await connection.execute(SQL.updateGatewayStatus, [
        status.status,
        status.wifiConnected,
        status.mqttConnected,
        status.wifiRssi,
        status.ipAddress,
        status.firmwareVersion,
        gateway.id,
      ])

      const row = await firstRow(connection, SQL.gatewayStatus, [
        status.roomId,
        gateway.gateway_code,
        gateway.gateway_code,
      ])
      return { changed: statusChanged, gateway: row }
    })
  }

  async insertGatewayMetrics(metrics) {
    return withTransaction(this.database, async (connection) => {
      const gateway = await firstRow(connection, SQL.resolveGatewayForUpdate, [
        metrics.roomId,
        metrics.gatewayId,
        metrics.gatewayId,
      ])
      if (!gateway) {
        throw new NotFoundError('Gateway was not found', {
          room_id: metrics.roomId,
          gateway_id: metrics.gatewayId,
        })
      }

      await connection.execute(SQL.insertGatewayMetrics, [
        gateway.id,
        metrics.cpuUsagePercent,
        metrics.ramHeapPercent,
        metrics.mqttQueuePercent,
        metrics.wifiSignalDbm,
        metrics.wifiConnected,
        metrics.mqttConnected,
        metrics.uptimeSeconds,
        metrics.recordedAt,
      ])
      const rowCount = await firstRow(connection, 'SELECT ROW_COUNT() AS row_count', [])

      await connection.execute(SQL.updateGatewayStatus, [
        metrics.wifiConnected && metrics.mqttConnected ? 'ONLINE' : 'DEGRADED',
        metrics.wifiConnected,
        metrics.mqttConnected,
        metrics.wifiSignalDbm,
        gateway.ip_address,
        gateway.firmware_version,
        gateway.id,
      ])

      const row = await firstRow(connection, SQL.gatewayStatus, [
        metrics.roomId,
        gateway.gateway_code,
        gateway.gateway_code,
      ])
      return { inserted: Number(rowCount.row_count) === 1, gateway: row }
    })
  }

  async markStaleNodesOffline(cutoff) {
    return withTransaction(this.database, async (connection) => {
      const [nodes] = await connection.execute(SQL.staleNodesForUpdate, [cutoff])
      if (nodes.length === 0) return []
      const placeholders = nodes.map(() => '?').join(', ')
      await connection.execute(
        `UPDATE sensor_nodes SET node_status = 'OFFLINE' WHERE id IN (${placeholders})`,
        nodes.map((node) => node.id),
      )
      return nodes.map((node) => ({ ...node, status: 'OFFLINE' }))
    })
  }

  async markStaleGatewaysOffline(cutoff) {
    return withTransaction(this.database, async (connection) => {
      const [gateways] = await connection.execute(SQL.staleGatewaysForUpdate, [cutoff])
      if (gateways.length === 0) return []
      const placeholders = gateways.map(() => '?').join(', ')
      await connection.execute(
        `UPDATE gateways
         SET gateway_status = 'OFFLINE', wifi_connected = 0, mqtt_connected = 0
         WHERE id IN (${placeholders})`,
        gateways.map((gateway) => gateway.id),
      )
      return gateways.map((gateway) => ({
        ...gateway,
        status: 'OFFLINE',
        wifi_connected: 0,
        mqtt_connected: 0,
      }))
    })
  }

  async rollupHourly(from, to) {
    await this.database.execute('CALL sp_rollup_sensor_data_hourly(?, ?)', [from, to])
  }

  async rollupDaily(from, to) {
    await this.database.execute('CALL sp_rollup_sensor_data_daily(?, ?)', [from, to])
  }

  async purgeRawData(retentionDays) {
    await this.database.execute('CALL sp_purge_expired_sensor_data(?)', [retentionDays])
  }
}
