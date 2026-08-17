import { CircleUserRound, LogOut, Radio, Wifi } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { decodeJwtPayload } from '../../lib/api'
import { getGatewayStatus } from '../../services/dev2Api'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../lib/api'

interface HeaderProps {
  onLogout: () => void
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/monitoring': 'Giám sát dữ liệu',
  '/devices': 'Điều khiển thiết bị',
  '/alerts': 'Cảnh báo',
  '/system-status': 'Trạng thái hệ thống',
  '/admin': 'Quản trị',
}

/** Khoảng thời gian tính là gateway Offline nếu không nhận được heartbeat (ms) */
const GATEWAY_STALE_MS = 90_000  // 90 giây — phù hợp với watchdog 60s của ESP32

/** Đọc WS base URL từ API_BASE_URL (http://host:port/api → http://host:port) */
function wsBase() {
  return API_BASE_URL.replace(/\/api$/, '')
}

export function Header({ onLogout }: HeaderProps) {
  const { pathname } = useLocation()
  const pageTitle = pageTitles[pathname] ?? pageTitles['/dashboard']

  const [user, setUser] = useState({ name: 'Loading...', role: '...' })
  const [time, setTime] = useState(new Date())

  /**
   * connection.mqtt   = MQTT Broker có kết nối không
   * connection.gateway = ESP32 Gateway có kết nối không (dựa theo last_seen_at)
   */
  const [connection, setConnection] = useState({ mqtt: false, gateway: false })
  const socketRef = useRef<Socket | null>(null)

  // ── Decode token để lấy tên & role người dùng ──────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      const decoded = decodeJwtPayload(token)
      if (decoded) {
        const isSuperAdmin = (decoded.username || '').toLowerCase() === 'baokhanhdtm'
        const role = isSuperAdmin ? 'ADMIN' : (decoded.role ? decoded.role.toUpperCase() : 'USER')
        setUser({ name: decoded.username || 'User', role })
        if (isSuperAdmin) localStorage.setItem('role', 'admin')
      }
    }
  }, [])

  // ── Gọi REST API một lần để lấy trạng thái ban đầu ─────────────────────────
  useEffect(() => {
    let active = true

    const fetchStatus = () => {
      getGatewayStatus()
        .then(gateway => {
          if (!active || !gateway) return
          const lastSeenStr = (gateway as unknown as Record<string, string>).last_seen_at ?? null
          const isOnline = gateway.status === 'Online'
          const mqttOk   = Boolean(gateway.mqtt_connected)

          // Nếu backend trả về last_seen_at, dùng để tính stale time
          if (lastSeenStr) {
            const stale = Date.now() - new Date(lastSeenStr).getTime() > GATEWAY_STALE_MS
            setConnection({ mqtt: mqttOk, gateway: isOnline && !stale })
          } else {
            setConnection({ mqtt: mqttOk, gateway: isOnline })
          }
        })
        .catch(() => {
          if (active) setConnection(prev => ({ ...prev, gateway: false }))
        })
    }

    fetchStatus()

    // Poll mỗi 30s như bảo hiểm, WebSocket sẽ cập nhật tức thì khi có sự kiện
    const pollId = setInterval(fetchStatus, 30_000)
    return () => { active = false; clearInterval(pollId) }
  }, [])

  // ── Lắng nghe WebSocket event "gateway:status" từ backend ──────────────────
  useEffect(() => {
    const socket = io(wsBase(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionDelay: 3000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-room', 'P.101')
    })

    // Backend phát event này khi ESP32 publish lên MQTT topic gateway/status
    socket.on('gateway:status', (data: { status?: string; mqtt_connected?: boolean; last_seen_at?: string }) => {
      const isOnline = data?.status === 'Online'
      const mqttOk   = Boolean(data?.mqtt_connected)

      if (data?.last_seen_at) {
        const stale = Date.now() - new Date(data.last_seen_at).getTime() > GATEWAY_STALE_MS
        setConnection({ mqtt: mqttOk, gateway: isOnline && !stale })
      } else {
        setConnection(prev => ({ mqtt: mqttOk ?? prev.mqtt, gateway: isOnline }))
      }
    })

    // Cập nhật MQTT khi broker reconnect/disconnect
    socket.on('connect', () =>
      setConnection(prev => ({ ...prev, mqtt: true }))
    )
    socket.on('disconnect', () =>
      setConnection(prev => ({ ...prev, mqtt: false }))
    )

    return () => { socket.disconnect() }
  }, [])

  // ── Đồng hồ ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#06152a] px-4 py-3 sm:px-6">
      <div>
        <p className="text-xs text-slate-400">Phòng học <span className="px-1">›</span> {pageTitle}</p>
        <p className="mt-1 text-sm font-semibold text-slate-100">Phòng P.101</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ConnectionPill icon={Radio} label="MQTT"    online={connection.mqtt}    />
        <ConnectionPill icon={Wifi}  label="Gateway" online={connection.gateway} />
        <span className="hidden font-mono text-xs text-slate-500 sm:inline">{time.toLocaleTimeString()}</span>
        <button
          className="group flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-2 text-sm text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200"
          onClick={onLogout}
          title="Đăng xuất"
          type="button"
        >
          <CircleUserRound aria-hidden="true" className="size-4 text-cyan-300" />
          <span className="hidden sm:inline">{user.name} · {user.role}</span>
          <LogOut aria-label="Đăng xuất" className="size-3.5 opacity-70 group-hover:opacity-100" />
        </button>
      </div>
    </header>
  )
}

function ConnectionPill({ icon: Icon, label, online }: { icon: typeof Radio; label: string; online: boolean }) {
  return (
    <span className={`hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium md:flex ${
      online
        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
        : 'border-rose-400/40 bg-rose-400/10 text-rose-300'
    }`}>
      <Icon aria-hidden="true" className="size-3" />
      {label}: {online ? 'Online' : 'Offline'}
    </span>
  )
}
