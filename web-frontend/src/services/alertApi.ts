import { API_BASE_URL, authHeaders } from '../lib/api'

export type AlertSeverity = 'WARNING' | 'CRITICAL'
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertVisibility = 'visible' | 'dismissed'

export interface AlertDto {
  id: string
  room_id: string
  type?: string
  severity: AlertSeverity
  source: string
  condition_key?: string | null
  message: string
  status: AlertStatus
  metadata: Record<string, unknown> | null
  created_at: string
  acknowledged_by: number | null
  acknowledged_at: string | null
  resolved_by: number | null
  resolved_at: string | null
}

export interface AlertSummaryDto {
  critical: number
  warning: number
  resolved: number
  unresolved: number
  total: number
}

interface SuccessResponse<T> {
  success: true
  data: T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!response.ok) {
    let message = `Không thể tải cảnh báo (${response.status})`
    try {
      const body = await response.json() as { message?: string }
      message = body.message || message
    } catch {
      // Keep the HTTP error when the server did not return JSON.
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

function toQuery(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  return query.toString()
}

export async function getAlerts({
  roomId = 'P.101',
  severity,
  status,
  visibility = 'visible',
  limit = 100,
}: {
  roomId?: string
  severity?: AlertSeverity
  status?: AlertStatus
  visibility?: AlertVisibility
  limit?: number
} = {}) {
  const query = toQuery({ room_id: roomId, severity, status, visibility, limit })
  const result = await request<SuccessResponse<AlertDto[]> & { total: number }>(`/alerts?${query}`)
  return result.data
}

export async function getAlertSummary(roomId = 'P.101') {
  const result = await request<SuccessResponse<AlertSummaryDto>>(`/alerts/summary?${toQuery({ room_id: roomId })}`)
  return result.data
}

export async function acknowledgeAlert(id: string) {
  const result = await request<SuccessResponse<AlertDto>>(`/alerts/${encodeURIComponent(id)}/acknowledge`, { method: 'PUT' })
  return result.data
}

export async function resolveAlert(id: string) {
  const result = await request<SuccessResponse<AlertDto>>(`/alerts/${encodeURIComponent(id)}/resolve`, { method: 'PUT' })
  return result.data
}

export async function dismissResolvedAlerts(roomId = 'P.101') {
  const result = await request<SuccessResponse<{ room_id: string; dismissed: number }>>(
    `/alerts/dismiss-resolved?${toQuery({ room_id: roomId })}`,
    { method: 'PUT' },
  )
  return result.data
}

export async function restoreDismissedAlert(id: string) {
  await request<SuccessResponse<{ id: string; room_id: string }>>(
    `/alerts/${encodeURIComponent(id)}/dismiss`,
    { method: 'DELETE' },
  )
}

export async function deleteAlert(id: string) {
  await request<SuccessResponse<{ id: string; room_id: string }>>(
    `/alerts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}
