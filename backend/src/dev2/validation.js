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
  const nowSec = Math.floor(Date.now() / 1000)
  const ts = payload.timestamp ?? nowSec
  const rawStatus = payload.status ? String(payload.status).toUpperCase() : 'VALID'
  const validStatus = ['VALID', 'PARTIAL', 'INVALID'].includes(rawStatus) ? rawStatus : 'VALID'

  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    nodeId: parseNodeId(payload.node_id ?? context.nodeId),
    temperature: finiteNumber(payload.temperature, 'temperature', { min: -40, max: 85 }),
    humidity: finiteNumber(payload.humidity, 'humidity', { min: 0, max: 100 }),
    pressureHpa: finiteNumber(payload.pressure_hpa ?? 1013.25, 'pressure_hpa', { min: 300, max: 1200, optional: true }),
    lightLux: finiteNumber(payload.light_lux ?? payload.light ?? payload.lux ?? 400, 'light_lux', { min: 0, max: 1000000 }),
    airQualityPpm: finiteNumber(payload.air_quality_ppm ?? payload.air_quality ?? payload.co2 ?? payload.ppm ?? 400, 'air_quality_ppm', { min: 0, max: 1000000 }),
    dataStatus: validStatus,
    bleRssi: finiteNumber(payload.ble_rssi ?? payload.rssi ?? -65, 'ble_rssi', { min: -127, max: 20, optional: true }),
    errorFlags: payload.error_flags === undefined ? null : payload.error_flags,
    sampledAt: epochSeconds(ts),
    timestamp: Number(ts),
  }
}

export function parseNodeStatusPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  const timestamp = payload.timestamp ?? payload.last_seen ?? Math.floor(Date.now() / 1000)
  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    nodeId: parseNodeId(payload.node_id ?? context.nodeId),
    status: enumValue(payload.status ?? 'ONLINE', 'status', ['ONLINE', 'WEAK_SIGNAL', 'OFFLINE', 'ERROR', 'UNKNOWN']),
    sensorHealth: enumValue(payload.sensor_health ?? 'OK', 'sensor_health', ['OK', 'DEGRADED', 'ERROR', 'UNKNOWN']),
    rssi: finiteNumber(payload.rssi ?? -65, 'rssi', { min: -127, max: 20, optional: true }),
    packetSuccessRate: finiteNumber(payload.packet_success_rate ?? 99.0, 'packet_success_rate', { min: 0, max: 100, optional: true }),
    batteryPercent: finiteNumber(payload.battery_percent, 'battery_percent', { min: 0, max: 100, optional: true }),
    lastSeenAt: epochSeconds(timestamp, 'timestamp'),
  }
}

export function parseGatewayStatusPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  const ts = payload.timestamp ?? Math.floor(Date.now() / 1000)
  const rawStatus = payload.status ? String(payload.status).toUpperCase() : 'ONLINE'
  const validStatus = ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN'].includes(rawStatus) ? rawStatus : 'ONLINE'

  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    gatewayId: optionalString(payload.gateway_id ?? 'GW-P101-01', 'gateway_id', GATEWAY_ID_PATTERN),
    status: validStatus,
    wifiConnected: payload.wifi_connected !== undefined ? Boolean(payload.wifi_connected) : true,
    mqttConnected: payload.mqtt_connected !== undefined ? Boolean(payload.mqtt_connected) : true,
    wifiRssi: finiteNumber(payload.wifi_rssi ?? payload.wifi_signal_dbm ?? -65, 'wifi_rssi', { min: -127, max: 20, optional: true }),
    ipAddress: optionalString(payload.ip_address, 'ip_address'),
    firmwareVersion: optionalString(payload.firmware_version ?? '1.0.0', 'firmware_version'),
    lastSeenAt: epochSeconds(ts),
  }
}

export function parseGatewayMetricsPayload(value, context) {
  const payload = plainObject(value)
  ensureTopicIdentity(payload, context)
  const ts = payload.timestamp ?? Math.floor(Date.now() / 1000)
  const freeRam = Number(payload.free_ram)
  const ramPercent = payload.ram_heap_percent !== undefined
    ? Number(payload.ram_heap_percent)
    : (Number.isFinite(freeRam) && freeRam > 0 ? Math.max(10, Math.min(95, Math.round((1 - freeRam / 320000) * 100))) : 50)

  return {
    roomId: parseRoomId(payload.room_id, context.roomId),
    gatewayId: optionalString(payload.gateway_id ?? 'GW-P101-01', 'gateway_id', GATEWAY_ID_PATTERN),
    cpuUsagePercent: finiteNumber(payload.cpu_usage_percent ?? 30, 'cpu_usage_percent', { min: 0, max: 100 }),
    ramHeapPercent: finiteNumber(ramPercent, 'ram_heap_percent', { min: 0, max: 100 }),
    mqttQueuePercent: finiteNumber(payload.mqtt_queue_percent ?? 10, 'mqtt_queue_percent', { min: 0, max: 100 }),
    wifiSignalDbm: finiteNumber(payload.wifi_signal_dbm ?? payload.wifi_rssi ?? -65, 'wifi_signal_dbm', { min: -127, max: 20 }),
    wifiConnected: payload.wifi_connected === undefined ? true : Boolean(payload.wifi_connected),
    mqttConnected: payload.mqtt_connected === undefined ? true : Boolean(payload.mqtt_connected),
    uptimeSeconds: finiteNumber(payload.uptime_seconds ?? payload.uptime ?? 0, 'uptime_seconds', { min: 0 }),
    recordedAt: epochSeconds(ts),
  }
}
