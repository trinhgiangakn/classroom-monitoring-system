const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export const API_BASE_URL = configuredBaseUrl || 'https://classroom-monitoring-system-btga.onrender.com/api'

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('role')
}

export function decodeJwtPayload(token: string): { exp?: number; role?: string; username?: string } | null {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

export function hasValidSession() {
  const token = localStorage.getItem('accessToken')
  if (!token) return false

  const payload = decodeJwtPayload(token)
  if (!payload || (payload.exp && payload.exp * 1000 <= Date.now())) {
    clearSession()
    return false
  }
  return true
}
