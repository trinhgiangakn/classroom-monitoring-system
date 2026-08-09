import { API_BASE_URL, authHeaders } from '../lib/api'

export const DEFAULT_ROOM_ID = 'P.101'

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d' | '90d'
export type DataType = 'all' | 'temperature' | 'humidity' | 'pressure' | 'light' | 'air_quality'

export interface LatestSensorDto {
  node_id: string
  temperature: number | null
  humidity: number | null
  pressure_hpa: number | null
  light_lux: number | null
  air_quality_ppm: number | null
  air_quality_status: string
  status: string
  timestamp: string | null
}

export interface NodeDto {
  node_id: string
  status: string
  rssi: number | null
  packet_success_rate: number | null
  last_seen: string
  sensor_health: string
  position: string | null
}

export interface RecentSensorDto extends LatestSensorDto {
  air_quality_ppm: number | null
}

export interface HistoryValueDto {
  timestamp: string | null
  value: number | null
}

export interface HistorySeriesDto {
  temperature?: HistoryValueDto[]
  humidity?: HistoryValueDto[]
  pressure?: HistoryValueDto[]
  light?: HistoryValueDto[]
  air_quality?: HistoryValueDto[]
}

export interface GatewayDto {
  gateway_id: string
  status: string
  wifi_connected: boolean
  mqtt_connected: boolean
  wifi_signal_dbm: number | null
  ip_address: string | null
  firmware_version: string | null
  last_seen: string
  metrics: {
    cpu_usage_percent: number | null
    ram_heap_percent: number | null
    mqtt_queue_percent: number | null
    uptime_seconds: number | null
    timestamp: string | null
  }
}

interface SuccessData<T> {
  success: true
  data: T
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  })

  if (!response.ok) {
    let message = `API request failed (${response.status})`
    try {
      const body = await response.json() as { message?: string; error?: { message?: string } }
      message = body.message || body.error?.message || message
    } catch {
      // The response is not JSON; keep the HTTP status message.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

function queryString(values: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  return query.toString()
}

export async function getLatestSensors(roomId = DEFAULT_ROOM_ID) {
  const result = await apiRequest<SuccessData<LatestSensorDto[]> & { room_id: string }>(
    `/sensors/latest?${queryString({ room_id: roomId })}`,
  )
  return result.data
}

export async function getSensorHistory({
  roomId = DEFAULT_ROOM_ID,
  timeRange = '24h',
  nodeId = 'all',
  dataType = 'all',
}: {
  roomId?: string
  timeRange?: TimeRange
  nodeId?: string
  dataType?: DataType
} = {}) {
  const query = queryString({ room_id: roomId, time_range: timeRange, node_id: nodeId, data_type: dataType })
  return apiRequest<{ success: true; time_range: TimeRange; series: HistorySeriesDto }>(`/sensors/history?${query}`)
}

export async function getRecentSensors({
  roomId = DEFAULT_ROOM_ID,
  timeRange = '24h',
  nodeId = 'all',
  limit = 50,
}: {
  roomId?: string
  timeRange?: TimeRange
  nodeId?: string
  limit?: number
} = {}) {
  const query = queryString({ room_id: roomId, time_range: timeRange, node_id: nodeId, limit })
  const result = await apiRequest<SuccessData<RecentSensorDto[]>>(`/sensors/recent?${query}`)
  return result.data
}

export async function getNodes(roomId = DEFAULT_ROOM_ID) {
  const result = await apiRequest<SuccessData<NodeDto[]>>(`/nodes?${queryString({ room_id: roomId })}`)
  return result.data
}

export async function getGatewayStatus(roomId = DEFAULT_ROOM_ID) {
  const result = await apiRequest<SuccessData<GatewayDto | GatewayDto[]>>(
    `/gateway/status?${queryString({ room_id: roomId })}`,
  )
  return Array.isArray(result.data) ? result.data[0] : result.data
}

export async function downloadSensorCsv({
  roomId = DEFAULT_ROOM_ID,
  timeRange = '24h',
  nodeId = 'all',
}: {
  roomId?: string
  timeRange?: TimeRange
  nodeId?: string
} = {}) {
  const query = queryString({ room_id: roomId, time_range: timeRange, node_id: nodeId })
  const response = await fetch(`${API_BASE_URL}/sensors/export?${query}`, { headers: authHeaders() })
  if (!response.ok) throw new Error(`Không thể xuất CSV (${response.status})`)

  const disposition = response.headers.get('content-disposition')
  const filename = disposition?.match(/filename="?([^";]+)"?/i)?.[1] || 'sensor_data.csv'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
