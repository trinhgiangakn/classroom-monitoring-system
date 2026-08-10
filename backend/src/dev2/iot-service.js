import { createHash } from 'node:crypto'
import { DEFAULT_ROOM_ID, DEFAULT_TIME_ZONE } from './constants.js'
import { NotFoundError } from './errors.js'
import {
  buildGatewayStatusEvent,
  buildHistorySeries,
  buildNodeStatusEvent,
  buildResourceUpdateEvent,
  buildSensorUpdateEvent,
  formatGatewayRow,
  formatLatestRow,
  formatNodeDetail,
  formatNodeRow,
  formatRecentRow,
  toCsv,
} from './formatters.js'
import {
  parseGatewayMetricsPayload,
  parseGatewayId,
  parseGatewayStatusPayload,
  parseHistoryQuery,
  parseNodeId,
  parseNodeStatusPayload,
  parseRecentQuery,
  parseRoomId,
  parseTelemetryPayload,
} from './validation.js'

function defaultAirQualityClassifier(ppm) {
  if (ppm < 50) return 'GOOD'
  if (ppm <= 100) return 'NORMAL'
  if (ppm <= 200) return 'POOR'
  return 'HAZARDOUS'
}

function sensorHealth(dataStatus) {
  if (dataStatus === 'VALID') return 'OK'
  if (dataStatus === 'PARTIAL') return 'DEGRADED'
  return 'ERROR'
}

function nodeStatusFromTelemetry(dataStatus, rssi) {
  if (dataStatus === 'INVALID') return 'ERROR'
  if (rssi !== null && rssi <= -75) return 'WEAK_SIGNAL'
  return 'ONLINE'
}

function stableIngestKey(sample) {
  return createHash('sha256')
    .update(`${sample.roomId}|${sample.nodeId}|${sample.timestamp}`)
    .digest('hex')
}

export class IotService {
  constructor(repository, {
    now = () => new Date(),
    timeZone = DEFAULT_TIME_ZONE,
    airQualityClassifier = defaultAirQualityClassifier,
  } = {}) {
    if (!repository) throw new TypeError('repository is required')
    this.repository = repository
    this.now = now
    this.timeZone = timeZone
    this.airQualityClassifier = airQualityClassifier
  }

  async latest(query = {}) {
    const roomId = parseRoomId(query.room_id, DEFAULT_ROOM_ID)
    const rows = await this.repository.getLatest(roomId)
    return {
      success: true,
      room_id: roomId,
      data: rows.map(formatLatestRow),
    }
  }

  async history(query = {}) {
    const options = parseHistoryQuery(query, { now: this.now() })
    const rows = await this.repository.getHistory(options)
    return {
      success: true,
      time_range: options.timeRange,
      series: buildHistorySeries(rows, options.dataType),
    }
  }

  async recent(query = {}) {
    const options = parseRecentQuery(query, { now: this.now() })
    const rows = await this.repository.getRecent(options)
    return {
      success: true,
      data: rows.map(formatRecentRow),
    }
  }

  async exportCsv(query = {}) {
    const options = parseHistoryQuery(query, { now: this.now() })
    const rows = await this.repository.getExportRows(options)
    const date = this.now().toISOString().slice(0, 10).replaceAll('-', '')
    const room = options.roomId.replaceAll(/[^A-Za-z0-9]/g, '')
    return {
      filename: `sensor_data_${room}_${date}.csv`,
      content: toCsv(rows),
    }
  }

  async nodes(query = {}) {
    const roomId = parseRoomId(query.room_id, DEFAULT_ROOM_ID)
    const rows = await this.repository.getNodes(roomId)
    const now = this.now()
    return { success: true, data: rows.map((row) => formatNodeRow(row, now)) }
  }

  async node(roomIdValue, nodeIdValue) {
    const roomId = parseRoomId(roomIdValue, DEFAULT_ROOM_ID)
    const nodeId = parseNodeId(nodeIdValue)
    const row = await this.repository.getNode(roomId, nodeId)
    if (!row) {
      throw new NotFoundError('Sensor node was not found', {
        room_id: roomId,
        node_id: nodeId,
      })
    }
    return { success: true, data: formatNodeDetail(row, this.now()) }
  }

  async gatewayStatus(query = {}) {
    const roomId = parseRoomId(query.room_id, DEFAULT_ROOM_ID)
    const gatewayId = query.gateway_id ? parseGatewayId(query.gateway_id) : null
    const rows = await this.repository.getGatewayStatus(roomId, gatewayId)
    if (rows.length === 0) {
      throw new NotFoundError('Gateway was not found', {
        room_id: roomId,
        gateway_id: gatewayId,
      })
    }
    return {
      success: true,
      data: rows.length === 1
        ? formatGatewayRow(rows[0], this.now())
        : rows.map((row) => formatGatewayRow(row, this.now())),
    }
  }

  async ingestTelemetry(value, context) {
    const sample = parseTelemetryPayload(value, context)
    const record = {
      ...sample,
      ingestKey: stableIngestKey(sample),
      airQualityStatus: this.airQualityClassifier(sample.airQualityPpm),
      sensorHealth: sensorHealth(sample.dataStatus),
      nodeStatus: nodeStatusFromTelemetry(sample.dataStatus, sample.bleRssi),
    }
    const result = await this.repository.insertTelemetry(record)
    const events = []

    if (result.inserted) {
      events.push({
        roomId: sample.roomId,
        nodeId: sample.nodeId,
        payload: buildSensorUpdateEvent({
          node_id: sample.nodeId,
          temperature: sample.temperature,
          humidity: sample.humidity,
          light_lux: sample.lightLux,
          air_quality_status: record.airQualityStatus,
          status: sample.dataStatus,
          timestamp: sample.sampledAt,
        }, this.timeZone),
      })
    }
    if (result.nodeStatusChanged) {
      events.push({
        roomId: sample.roomId,
        nodeId: sample.nodeId,
        payload: buildNodeStatusEvent(result.node, this.now()),
      })
    }

    return { duplicate: !result.inserted, events }
  }

  async ingestNodeStatus(value, context) {
    const status = parseNodeStatusPayload(value, context)
    const result = await this.repository.updateNodeStatus(status)
    return {
      events: result.changed
        ? [{
            roomId: status.roomId,
            nodeId: status.nodeId,
            payload: buildNodeStatusEvent(result.node, this.now()),
          }]
        : [],
    }
  }

  async ingestGatewayStatus(value, context) {
    const status = parseGatewayStatusPayload(value, context)
    const result = await this.repository.updateGatewayStatus(status)
    return {
      events: result.changed
        ? [{
            roomId: status.roomId,
            payload: buildGatewayStatusEvent(result.gateway, this.now()),
          }]
        : [],
    }
  }

  async ingestGatewayMetrics(value, context) {
    const metrics = parseGatewayMetricsPayload(value, context)
    const result = await this.repository.insertGatewayMetrics(metrics)
    return {
      events: result.inserted
        ? [{
            roomId: metrics.roomId,
            payload: buildResourceUpdateEvent(result.gateway),
          }]
        : [],
    }
  }

  async markOfflineNodes(cutoff) {
    const nodes = await this.repository.markStaleNodesOffline(cutoff)
    return nodes.map((node) => ({
      roomId: node.room_id,
      nodeId: node.node_id,
      payload: buildNodeStatusEvent(node, this.now()),
    }))
  }
}
