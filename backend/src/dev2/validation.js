import { HISTORY_RANGES } from './constants.js'
import { ValidationError } from './errors.js'

const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/
const NODE_ID_PATTERN = /^NODE-[A-Za-z0-9_-]{1,40}$/
const GATEWAY_ID_PATTERN = /^GW-[A-Za-z0-9_-]{1,40}$/

function plainObject(value, field = 'payload') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} must be a JSON object`, { field })
  }
  return value
}

function requiredString(value, field, pattern) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ValidationError(`${field} is required`, { field })
  }
  const normalized = value.trim()
  if (pattern && !pattern.test(normalized)) {
    throw new ValidationError(`${field} has an invalid format`, { field, value })
  }
  return normalized
}

function optionalString(value, field, pattern) {
  if (value === undefined || value === null || value === '') return null
  return requiredString(value, field, pattern)
}

function finiteNumber(value, field, { min = -Infinity, max = Infinity, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`, { field, value })
  }
  return number
}

function booleanValue(value, field) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} must be boolean`, { field, value })
  }
  return value
}

function enumValue(value, field, allowed) {
  const normalized = requiredString(value, field).toUpperCase()
  if (!allowed.includes(normalized)) {
    throw new ValidationError(`${field} is not supported`, { field, value, allowed })
  }
  return normalized
}

function epochSeconds(value, field = 'timestamp') {
  const number = finiteNumber(value, field, { min: 1 })
  if (!Number.isInteger(number)) {
    throw new ValidationError(`${field} must be Unix epoch seconds`, { field, value })
  }
  const date = new Date(number * 1000)
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${field} is invalid`, { field, value })
  }
  return date
}

function ensureTopicIdentity(payload, context) {
  if (payload.room_id !== undefined && payload.room_id !== context.roomId) {
    throw new ValidationError('room_id does not match MQTT topic', {
      topic: context.roomId,
      payload: payload.room_id,
    })
  }
  if (context.nodeId && payload.node_id !== undefined && payload.node_id !== context.nodeId) {
    throw new ValidationError('node_id does not match MQTT topic', {
      topic: context.nodeId,
      payload: payload.node_id,
    })
  }
}

export function parseRoomId(value, fallback) {
  return requiredString(value ?? fallback, 'room_id', ROOM_ID_PATTERN)
}

export function parseNodeId(value) {
  return requiredString(value, 'node_id', NODE_ID_PATTERN)
}

export function parseGatewayId(value) {
  return requiredString(value, 'gateway_id', GATEWAY_ID_PATTERN)
}

export function parseHistoryQuery(query, { now = new Date() } = {}) {
  plainObject(query, 'query')
  const roomId = parseRoomId(query.room_id, 'P.101')
  const timeRange = query.time_range ?? '24h'
  const range = HISTORY_RANGES[timeRange]
  if (!range) {
    throw new ValidationError('time_range is not supported', {
      field: 'time_range',
      value: timeRange,
      allowed: Object.keys(HISTORY_RANGES),
    })
  }
  const nodeId = query.node_id === undefined || query.node_id === 'all'
    ? null
    : parseNodeId(query.node_id)
  const dataType = query.data_type ?? 'all'
  if (!['all', 'temperature', 'humidity', 'pressure', 'light', 'air_quality'].includes(dataType)) {
    throw new ValidationError('data_type is not supported', {
      field: 'data_type',
      value: dataType,
      allowed: ['all', 'temperature', 'humidity', 'pressure', 'light', 'air_quality'],
    })
  }

  const to = new Date(now)
  const from = new Date(to.getTime() - range.milliseconds)
  return { roomId, timeRange, nodeId, dataType, from, to, source: range.source }
}

export function parseRecentQuery(query, { now = new Date() } = {}) {
  const history = parseHistoryQuery(query, { now })
  const limit = Math.trunc(finiteNumber(query.limit ?? 50, 'limit', { min: 1, max: 500 }))
  const offset = Math.trunc(finiteNumber(query.offset ?? 0, 'offset', { min: 0, max: 1000000 }))
  return { ...history, limit, offset }
}

export function parseTelemetryPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    nodeId: parseNodeId(payload.node_id ?? context.nodeId),
    temperature: finiteNumber(payload.temperature, 'temperature', { min: -40, max: 85 }),
    humidity: finiteNumber(payload.humidity, 'humidity', { min: 0, max: 100 }),
    pressureHpa: finiteNumber(payload.pressure_hpa, 'pressure_hpa', { min: 300, max: 1200, optional: true }),
    lightLux: finiteNumber(payload.light_lux, 'light_lux', { min: 0, max: 1000000 }),
    airQualityPpm: finiteNumber(payload.air_quality_ppm, 'air_quality_ppm', { min: 0, max: 1000000 }),
    dataStatus: enumValue(payload.status, 'status', ['VALID', 'PARTIAL', 'INVALID']),
    bleRssi: finiteNumber(payload.ble_rssi, 'ble_rssi', { min: -127, max: 20, optional: true }),
    errorFlags: payload.error_flags === undefined ? null : payload.error_flags,
    sampledAt: epochSeconds(payload.timestamp),
    timestamp: Number(payload.timestamp),
  }
}

export function parseNodeStatusPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  const timestamp = payload.timestamp ?? payload.last_seen
  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    nodeId: parseNodeId(payload.node_id ?? context.nodeId),
    status: enumValue(payload.status, 'status', ['ONLINE', 'WEAK_SIGNAL', 'OFFLINE', 'ERROR', 'UNKNOWN']),
    sensorHealth: enumValue(payload.sensor_health ?? 'UNKNOWN', 'sensor_health', ['OK', 'DEGRADED', 'ERROR', 'UNKNOWN']),
    rssi: finiteNumber(payload.rssi, 'rssi', { min: -127, max: 20, optional: true }),
    packetSuccessRate: finiteNumber(payload.packet_success_rate, 'packet_success_rate', { min: 0, max: 100, optional: true }),
    batteryPercent: finiteNumber(payload.battery_percent, 'battery_percent', { min: 0, max: 100, optional: true }),
    lastSeenAt: epochSeconds(timestamp, 'timestamp'),
  }
}

export function parseGatewayStatusPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    gatewayId: optionalString(payload.gateway_id, 'gateway_id', GATEWAY_ID_PATTERN),
    status: enumValue(payload.status, 'status', ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN']),
    wifiConnected: booleanValue(payload.wifi_connected, 'wifi_connected'),
    mqttConnected: booleanValue(payload.mqtt_connected, 'mqtt_connected'),
    wifiRssi: finiteNumber(payload.wifi_rssi, 'wifi_rssi', { min: -127, max: 20, optional: true }),
    ipAddress: optionalString(payload.ip_address, 'ip_address'),
    firmwareVersion: optionalString(payload.firmware_version, 'firmware_version'),
    lastSeenAt: epochSeconds(payload.timestamp),
  }
}

export function parseGatewayMetricsPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    gatewayId: optionalString(payload.gateway_id, 'gateway_id', GATEWAY_ID_PATTERN),
    cpuUsagePercent: finiteNumber(payload.cpu_usage_percent, 'cpu_usage_percent', { min: 0, max: 100 }),
    ramHeapPercent: finiteNumber(payload.ram_heap_percent, 'ram_heap_percent', { min: 0, max: 100 }),
    mqttQueuePercent: finiteNumber(payload.mqtt_queue_percent, 'mqtt_queue_percent', { min: 0, max: 100 }),
    wifiSignalDbm: finiteNumber(payload.wifi_signal_dbm, 'wifi_signal_dbm', { min: -127, max: 20 }),
    wifiConnected: payload.wifi_connected === undefined ? true : booleanValue(payload.wifi_connected, 'wifi_connected'),
    mqttConnected: payload.mqtt_connected === undefined ? true : booleanValue(payload.mqtt_connected, 'mqtt_connected'),
    uptimeSeconds: finiteNumber(payload.uptime_seconds, 'uptime_seconds', { min: 0 }),
    recordedAt: epochSeconds(payload.timestamp),
  }
}
