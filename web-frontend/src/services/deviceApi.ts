import { API_BASE_URL, authHeaders } from '../lib/api'

export interface DeviceDto {
  device_id: string
  name: string
  type: 'RELAY' | 'MOTOR'
  actual_state: string // 'ON' | 'OFF' | 'OPENING' | 'CLOSING' | 'STOPPED'
  desired_state?: string
  operation_mode: 'AUTO' | 'MANUAL'
  limit_open_status?: string
  limit_close_status?: string
  timeout_seconds?: number
}

export interface DeviceCommandLogDto {
  command_id: string
  device_id: string
  device_name?: string
  action: string
  requested_by?: string
  source?: 'MANUAL' | 'AUTO'
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT'
  execution_time_ms?: number | null
  requested_at?: string
  ack_received_at?: string | null
}

export interface DeviceResponse {
  success: boolean
  room_id: string
  operation_mode: 'AUTO' | 'MANUAL'
  manual_control_locked: boolean
  devices: DeviceDto[]
}

/**
 * Lấy danh sách thiết bị và chế độ vận hành phòng học
 */
export async function getDevices(roomId = 'P.101'): Promise<DeviceResponse> {
  const response = await fetch(`${API_BASE_URL}/devices?room_id=${roomId}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    let message = `Lỗi tải danh sách thiết bị (${response.status})`
    try {
      const body = await response.json()
      message = body.message || message
    } catch {
      // Ignored
    }
    throw new Error(message)
  }

  const data = await response.json()
  const devices: DeviceDto[] = data.devices || data.data || []
  const operationMode = data.operation_mode || devices[0]?.operation_mode || 'MANUAL'

  return {
    success: true,
    room_id: data.room_id || roomId,
    operation_mode: operationMode,
    manual_control_locked: operationMode === 'AUTO',
    devices,
  }
}

/**
 * Chuyển đổi chế độ hoạt động (AUTO / MANUAL)
 */
export async function setOperationMode(mode: 'AUTO' | 'MANUAL', roomId = 'P.101'): Promise<{
  success: boolean
  message: string
  current_mode: 'AUTO' | 'MANUAL'
}> {
  const response = await fetch(`${API_BASE_URL}/devices/mode`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ mode, room_id: roomId }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || `Lỗi cập nhật chế độ (${response.status})`)
  }

  return {
    success: true,
    message: data.message || `Đã chuyển sang chế độ ${mode}`,
    current_mode: data.current_mode || mode,
  }
}

/**
 * Gửi lệnh điều khiển thiết bị (TURN_ON, TURN_OFF, OPEN, CLOSE, STOP)
 */
export async function controlDevice(
  deviceId: string,
  action: 'TURN_ON' | 'TURN_OFF' | 'OPEN' | 'CLOSE' | 'STOP'
): Promise<{ success: boolean; command_id: string; status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/devices/${encodeURIComponent(deviceId)}/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ action }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || `Lỗi gửi lệnh điều khiển (${response.status})`)
  }

  return {
    success: true,
    command_id: data.command_id || data.data?.command_id || '',
    status: data.status || data.data?.status || 'PENDING_ACK',
    message: data.message || 'Lệnh đã được chuyển tới ESP32 Gateway',
  }
}

/**
 * Lấy lịch sử các lệnh điều khiển gần đây
 */
export async function getDeviceCommands(limit = 20): Promise<DeviceCommandLogDto[]> {
  const response = await fetch(`${API_BASE_URL}/device-commands?limit=${limit}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Lỗi tải lịch sử lệnh (${response.status})`)
  }

  const data = await response.json()
  return data.data || []
}
