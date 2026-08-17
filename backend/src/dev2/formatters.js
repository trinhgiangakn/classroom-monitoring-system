import {
  AIR_QUALITY_LABELS,
  DATA_STATUS_LABELS,
  DEFAULT_TIME_ZONE,
  GATEWAY_STATUS_LABELS,
  NODE_STATUS_LABELS,
} from './constants.js'

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isoOrNull(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatTime(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatRelativeSeconds(value, now = new Date()) {
  if (!value) return 'Chưa nhận dữ liệu'
  const date = value instanceof Date ? value : new Date(value)
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  if (seconds < 60) return `${seconds} giây`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  return `${hours} giờ`
}

export function formatLatestRow(row) {
  return {
    node_id: row.node_id,
    temperature: numberOrNull(row.temperature),
    humidity: numberOrNull(row.humidity),
    pressure_hpa: numberOrNull(row.pressure_hpa),
    light_lux: numberOrNull(row.light_lux),
    air_quality_ppm: numberOrNull(row.air_quality_ppm),
    air_quality_status: AIR_QUALITY_LABELS[row.air_quality_status] ?? AIR_QUALITY_LABELS.UNKNOWN,
    status: DATA_STATUS_LABELS[row.status] ?? DATA_STATUS_LABELS.INVALID,
    timestamp: isoOrNull(row.timestamp),
  }
}

export function formatRecentRow(row) {
  return {
    timestamp: isoOrNull(row.timestamp),
    node_id: row.node_id,
    temperature: numberOrNull(row.temperature),
    humidity: numberOrNull(row.humidity),
    pressure_hpa: numberOrNull(row.pressure_hpa),
    light_lux: numberOrNull(row.light_lux),
    air_quality_ppm: numberOrNull(row.air_quality_ppm),
    air_quality_status: AIR_QUALITY_LABELS[row.air_quality_status] ?? AIR_QUALITY_LABELS.UNKNOWN,
    status: DATA_STATUS_LABELS[row.status] ?? DATA_STATUS_LABELS.INVALID,
  }
}

export function formatNodeRow(row, now = new Date()) {
  return {
    node_id: row.node_id,
    status: NODE_STATUS_LABELS[row.status] ?? NODE_STATUS_LABELS.UNKNOWN,
    rssi: numberOrNull(row.rssi),
    packet_success_rate: numberOrNull(row.packet_success_rate),
    last_seen: formatRelativeSeconds(row.last_seen_at, now),
    sensor_health: row.sensor_health ?? 'UNKNOWN',
    position: row.position ?? null,
  }
}

export function formatNodeDetail(row, now = new Date()) {
  return {
    ...formatNodeRow({ ...row, status: row.node_status }, now),
    node_name: row.node_name,
    mac_address: row.mac_address,
    position: row.position,
    firmware_version: row.firmware_version,
    battery_percent: numberOrNull(row.battery_percent),
    gateway_id: row.gateway_id,
    latest_telemetry: row.timestamp
      ? formatLatestRow({ ...row, status: row.telemetry_status })
      : null,
  }
}

export function formatGatewayRow(row, now = new Date()) {
  return {
    gateway_id: row.gateway_id,
    status: GATEWAY_STATUS_LABELS[row.status] ?? GATEWAY_STATUS_LABELS.UNKNOWN,
    wifi_connected: Boolean(row.wifi_connected),
    mqtt_connected: Boolean(row.mqtt_connected),
    wifi_signal_dbm: numberOrNull(row.wifi_signal_dbm),
    ip_address: row.ip_address ?? null,
    firmware_version: row.firmware_version ?? null,
    last_seen: formatRelativeSeconds(row.last_seen_at, now),
    metrics: {
      cpu_usage_percent: numberOrNull(row.cpu_usage_percent),
      ram_heap_percent: numberOrNull(row.ram_heap_percent),
      mqtt_queue_percent: numberOrNull(row.mqtt_queue_percent),
      uptime_seconds: numberOrNull(row.uptime_seconds),
      timestamp: isoOrNull(row.metrics_recorded_at),
    },
  }
}

export function buildHistorySeries(rows, dataType = 'all') {
  const definitions = {
    temperature: 'temperature',
    humidity: 'humidity',
    pressure: 'pressure_hpa',
    light: 'light_lux',
    air_quality: 'air_quality_ppm',
  }
  const selected = dataType === 'all' ? Object.keys(definitions) : [dataType]
  return Object.fromEntries(selected.map((key) => [
    key,
    rows
      .filter((row) => numberOrNull(row[definitions[key]]) !== null)
      .map((row) => ({
        timestamp: isoOrNull(row.timestamp),
        value: numberOrNull(row[definitions[key]]),
      })),
  ]))
}

export function buildSensorUpdateEvent(row, timeZone = DEFAULT_TIME_ZONE) {
  return {
    event: 'sensor:update',
    data: {
      time: formatTime(row.timestamp, timeZone),
      node_id: row.node_id,
      temperature: numberOrNull(row.temperature),
      humidity: numberOrNull(row.humidity),
      light_lux: numberOrNull(row.light_lux),
      air_quality: AIR_QUALITY_LABELS[row.air_quality_status] ?? AIR_QUALITY_LABELS.UNKNOWN,
      status: DATA_STATUS_LABELS[row.status] ?? DATA_STATUS_LABELS.INVALID,
    },
  }
}

export function buildNodeStatusEvent(row, now = new Date()) {
  return {
    event: 'node:status',
    data: formatNodeRow(row, now),
  }
}

export function buildGatewayStatusEvent(row, now = new Date()) {
  const data = formatGatewayRow(row, now)
  delete data.metrics
  return { event: 'gateway:status', data }
}

export function buildResourceUpdateEvent(row) {
  return {
    event: 'system:resource-update',
    data: {
      cpu_usage_percent: numberOrNull(row.cpu_usage_percent),
      ram_heap_percent: numberOrNull(row.ram_heap_percent),
      mqtt_queue_percent: numberOrNull(row.mqtt_queue_percent),
      wifi_signal_dbm: numberOrNull(row.wifi_signal_dbm),
    },
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows) {
  const headers = [
    'timestamp',
    'node_id',
    'temperature',
    'humidity',
    'pressure_hpa',
    'light_lux',
    'air_quality_ppm',
    'air_quality_status',
    'status',
  ]
  const lines = [headers.join(',')]
  for (const row of rows.map(formatRecentRow)) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','))
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
