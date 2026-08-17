import { API_BASE_URL, authHeaders } from '../lib/api'

export interface UserItem {
  id: number | string
  full_name?: string
  fullname?: string
  username?: string
  email?: string
  role: 'admin' | 'technician' | 'user' | 'manager' | string
  status: 'approved' | 'pending' | 'rejected' | 'Hoạt động' | 'Tạm khóa' | string
  reset_requested?: number
  created_at?: string
  last_login?: string
  last_active_at?: string
  is_online?: number | boolean
}

export interface AuditLogItem {
  id: number
  user_id?: number | string
  username?: string
  full_name?: string
  role?: string
  action: string
  details?: string
  created_at: string
}

export async function logoutApi(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    })
  } catch {
    // Ignore network failures on logout
  }
}

export async function heartbeatApi(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/heartbeat`, {
      method: 'POST',
      headers: authHeaders(),
    })
  } catch {
    // Silent fail
  }
}

/**
 * Lấy danh sách tài khoản người dùng từ hệ thống
 */
export async function getAdminUsers(): Promise<UserItem[]> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/users`, {
    headers: authHeaders(),
  })

  // 403 = tài khoản không có quyền admin — trả về danh sách rỗng, không throw lỗi
  if (response.status === 403 || response.status === 401) {
    return []
  }

  if (!response.ok) {
    // Fallback sang endpoint /api/users nếu có
    const fallbackRes = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders() })
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json()
      return fbData.data || fbData
    }
    throw new Error(`Lỗi tải danh sách người dùng (${response.status})`)
  }

  return response.json()
}

/**
 * Cập nhật vai trò (Role) của người dùng
 */
export async function updateUserRole(userId: number | string, role: 'admin' | 'technician' | 'user'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ role }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.message || `Lỗi cập nhật quyền người dùng (${response.status})`)
  }
}

/**
 * Xóa người dùng khỏi hệ thống
 */
export async function deleteUser(userId: number | string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.message || `Lỗi xóa người dùng (${response.status})`)
  }
}

/**
 * Phê duyệt hoặc từ chối tài khoản đăng ký mới
 */
export async function approveUserRegistration(email: string, status: 'approved' | 'rejected'): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/approve-user`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ target_email: email, new_status: status }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.message || `Lỗi duyệt tài khoản (${response.status})`)
  }
}

/**
 * Phê duyệt cấp lại mật khẩu cho người dùng
 */
export async function approvePasswordReset(email: string): Promise<{ resetLink?: string; message?: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/admin/approve-reset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ target_email: email }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Lỗi cấp lại mật khẩu')
  }

  return data
}

/**
 * Tạo người dùng mới từ trang quản trị
 */
export async function createUserByAdmin(userData: {
  full_name: string
  email: string
  password?: string
  role: string
}): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({
      full_name: userData.full_name,
      email: userData.email,
      password: userData.password || 'SmartClass@123',
      role: userData.role,
    }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.message || 'Lỗi tạo tài khoản mới')
  }
}

/**
 * Lấy lịch sử thao tác hệ thống (Audit Logs)
 */
export async function getAuditLogs(limit = 10): Promise<AuditLogItem[]> {
  const response = await fetch(`${API_BASE_URL}/audit-logs?limit=${limit}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Lỗi tải nhật ký thao tác (${response.status})`)
  }

  const data = await response.json()
  return data.data || []
}

export interface RuleItem {
  id: string
  rule_id: number
  device_id: string
  device: string
  rule_name: string
  sensor: string
  condition: string
  enabled: boolean
}

export interface AutomationThresholds {
  tempOn: number | string
  tempOff: number | string
  humidityOn: number | string
  humidityOff: number | string
  lightCurtainClose: number | string
  lightLampOn: number | string
}

/**
 * Lấy danh sách quy tắc tự động hóa (Rule Engine)
 */
export async function getAutomationRules(): Promise<RuleItem[]> {
  const response = await fetch(`${API_BASE_URL}/automation/rules`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Lỗi tải danh sách luật tự động (${response.status})`)
  }

  const data = await response.json()
  return data.data || []
}

/**
 * Bật / Tắt một quy tắc tự động
 */
export async function toggleAutomationRule(ruleId: string | number, enabled?: boolean): Promise<{ enabled: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/automation/rules/${ruleId}/toggle`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ enabled }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Lỗi cập nhật luật tự động (${response.status})`)
  }

  return response.json()
}

/**
 * Lấy cấu hình ngưỡng kích hoạt cảm biến
 */
export async function getAutomationThresholds(): Promise<AutomationThresholds> {
  const response = await fetch(`${API_BASE_URL}/automation/thresholds`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Lỗi tải cấu hình ngưỡng (${response.status})`)
  }

  const data = await response.json()
  return data.data
}

/**
 * Cập nhật cấu hình ngưỡng kích hoạt cảm biến
 */
export async function updateAutomationThresholds(thresholds: AutomationThresholds): Promise<{ message: string; data: AutomationThresholds }> {
  const response = await fetch(`${API_BASE_URL}/automation/thresholds`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(thresholds),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Lỗi lưu cấu hình ngưỡng (${response.status})`)
  }

  return response.json()
}

export interface ApiAlertItem {
  id: string
  title: string
  message: string
  severity: 'warning' | 'info' | 'success'
  rawSeverity: string
  source: string
  time: string
  createdAt: string
  isResolved: boolean
}

/**
 * Lấy danh sách cảnh báo từ hệ thống
 */
export async function getAlerts(limit = 20): Promise<ApiAlertItem[]> {
  const response = await fetch(`${API_BASE_URL}/alerts?limit=${limit}`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Lỗi tải danh sách cảnh báo (${response.status})`)
  }

  const data = await response.json()
  return data.data || []
}

/**
 * Đánh dấu xử lý cảnh báo
 */
export async function resolveAlert(alertId: string | number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, {
    method: 'PUT',
    headers: authHeaders(),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Lỗi xử lý cảnh báo (${response.status})`)
  }
}
