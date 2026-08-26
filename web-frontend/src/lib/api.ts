const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const isLocalhost = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

export const API_BASE_URL = configuredBaseUrl || (import.meta.env.MODE === 'test' || isLocalhost
  ? 'http://localhost:3000/api'
  : 'https://classroom-monitoring-system-btga.onrender.com/api')

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

export function getUserRole(): 'admin' | 'technician' | 'user' {
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!storage) return 'user'
  const storedRole = (storage.getItem('role') || '').toLowerCase()
  if (storedRole === 'user') return 'user'
  if (storedRole === 'technician') return 'technician'
  if (storedRole === 'admin' || storedRole === 'manager') return 'admin'

  const token = storage.getItem('accessToken')
  const payload = token ? decodeJwtPayload(token) : null
  const payloadRole = (payload?.role || '').toLowerCase()
  const username = (payload?.username || '').toLowerCase()

  if (username === 'baokhanhdtm') return 'admin'
  if (payloadRole === 'admin' || payloadRole === 'manager') return 'admin'
  if (payloadRole === 'technician') return 'technician'
  return 'user'
}


