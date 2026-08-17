export const DEFAULT_ROOM_ID = 'P.101'
export const DEFAULT_TIME_ZONE = 'Asia/Bangkok'
export const NODE_OFFLINE_AFTER_SECONDS = 15
export const RAW_RETENTION_DAYS = 90

export const MQTT_TOPICS = Object.freeze([
  'classroom/+/sensor/+/telemetry',
  'classroom/+/sensor/+/status',
  'classroom/+/gateway/status',
  'classroom/+/gateway/metrics',
])

export const DATA_STATUS_LABELS = Object.freeze({
  VALID: 'Hợp lệ',
  PARTIAL: 'Thiếu dữ liệu',
  INVALID: 'Không hợp lệ',
})

export const AIR_QUALITY_LABELS = Object.freeze({
  GOOD: 'Tốt',
  NORMAL: 'Bình thường',
  POOR: 'Kém',
  HAZARDOUS: 'Nguy hiểm',
  UNKNOWN: 'Không xác định',
})

export const NODE_STATUS_LABELS = Object.freeze({
  ONLINE: 'Online',
  WEAK_SIGNAL: 'Tín hiệu yếu',
  OFFLINE: 'Offline',
  ERROR: 'Lỗi',
  UNKNOWN: 'Không xác định',
})

export const GATEWAY_STATUS_LABELS = Object.freeze({
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  DEGRADED: 'Suy giảm',
  UNKNOWN: 'Không xác định',
})

export const HISTORY_RANGES = Object.freeze({
  '1h': { milliseconds: 60 * 60 * 1000, source: 'raw' },
  '6h': { milliseconds: 6 * 60 * 60 * 1000, source: 'raw' },
  '24h': { milliseconds: 24 * 60 * 60 * 1000, source: 'hourly' },
  '7d': { milliseconds: 7 * 24 * 60 * 60 * 1000, source: 'hourly' },
  '30d': { milliseconds: 30 * 24 * 60 * 60 * 1000, source: 'daily' },
  '90d': { milliseconds: 90 * 24 * 60 * 60 * 1000, source: 'daily' },
})
