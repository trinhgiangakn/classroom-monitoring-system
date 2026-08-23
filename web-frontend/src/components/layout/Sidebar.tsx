import {
  Bell,
  ChartNoAxesCombined,
  LayoutDashboard,
  MonitorCog,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { getAlertSummary } from '../../services/alertApi'
import { getGatewayStatus, getSystemHealth } from '../../services/dev2Api'
import {
  ALERT_REALTIME_EVENTS,
  subscribeToConnection,
  subscribeToRealtime,
  type RealtimeConnectionState,
} from '../../services/socket'

const navigationItems = [
  { label: 'Tổng quan', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Giám sát dữ liệu', icon: ChartNoAxesCombined, to: '/monitoring' },
  { label: 'Điều khiển thiết bị', icon: SlidersHorizontal, to: '/devices' },
  { label: 'Cảnh báo', icon: Bell, to: '/alerts' },
  { label: 'Trạng thái hệ thống', icon: MonitorCog, to: '/system-status' },
  { label: 'Quản trị', icon: Settings, to: '/admin' },
]

export function Sidebar() {
  const [unresolvedAlerts, setUnresolvedAlerts] = useState<number | null>(null)
  const [connection, setConnection] = useState<RealtimeConnectionState>('disconnected')
  const [mqttOnline, setMqttOnline] = useState<boolean | null>(null)
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null)
  const [databaseOnline, setDatabaseOnline] = useState<boolean | null>(null)
  const refreshAlertCount = useCallback(() => {
    void getAlertSummary().then(summary => setUnresolvedAlerts(summary.unresolved)).catch(() => setUnresolvedAlerts(null))
  }, [])
  const refreshServiceStatus = useCallback(async () => {
    const [healthResult, gatewayResult] = await Promise.allSettled([
      getSystemHealth(),
      getGatewayStatus(),
    ])
    if (healthResult.status === 'fulfilled' && healthResult.value) {
      setMqttOnline(healthResult.value.services?.mqtt?.connected ?? healthResult.value.mqtt_connected)
      setDatabaseOnline(healthResult.value.services?.database?.connected ?? false)
    } else {
      setMqttOnline(null)
      setDatabaseOnline(null)
    }
    setGatewayOnline(gatewayResult.status === 'fulfilled' && gatewayResult.value
      ? gatewayResult.value.status === 'Online'
      : null)
  }, [])

  useEffect(() => {
    refreshAlertCount()
    return subscribeToRealtime(ALERT_REALTIME_EVENTS, refreshAlertCount)
  }, [refreshAlertCount])

  useEffect(() => {
    void refreshServiceStatus()
    const interval = window.setInterval(() => { void refreshServiceStatus() }, 15_000)
    return () => window.clearInterval(interval)
  }, [refreshServiceStatus])

  useEffect(() => subscribeToRealtime(['gateway:status', 'system:resource-update'], () => { void refreshServiceStatus() }), [refreshServiceStatus])

  useEffect(() => subscribeToConnection(state => {
    setConnection(state)
    if (state === 'connected') void refreshServiceStatus()
  }), [refreshServiceStatus])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-[#08182e] lg:min-h-screen lg:w-64 lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 font-bold text-cyan-300">
          CM
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-cyan-300">CLASSROOM MONITORING</p>
          <p className="text-xs text-slate-400">Giám sát & điều khiển</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-cyan-400/20 bg-slate-950/30 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phòng học</p>
        <p className="mt-1 text-sm font-semibold text-cyan-200">P.101</p>
        <p className={`mt-1 text-[10px] font-semibold ${connection === 'connected' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}`}>
          ● Realtime {connection === 'connected' ? 'đã kết nối' : connection === 'connecting' ? 'đang kết nối' : 'mất kết nối'}
        </p>
      </div>

      <nav aria-label="Điều hướng dashboard" className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
        {navigationItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            className={({ isActive }) => `flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
              isActive
                ? 'bg-cyan-400/15 font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-400/35'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }`}
            key={label}
            to={to}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{label}</span>
            {label === 'Cảnh báo' && unresolvedAlerts ? (
              <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                {unresolvedAlerts > 99 ? '99+' : unresolvedAlerts}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto hidden border-t border-slate-800 px-5 py-5 lg:block">
        <p className="text-xs text-slate-500">Telemetry 5 giây · MQTT QoS 1</p>
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          <StatusLine label="MQTT Broker" online={mqttOnline} />
          <StatusLine label="Gateway ESP32" online={gatewayOnline} />
          <StatusLine label="Cơ sở dữ liệu" online={databaseOnline} />
        </div>
      </div>
    </aside>
  )
}

function StatusLine({ label, online }: { label: string; online: boolean | null }) {
  const title = online === null ? 'Không xác định' : online ? 'Online' : 'Offline'
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={`size-2 rounded-full ${online === null ? 'bg-slate-500' : online ? 'bg-emerald-400' : 'bg-rose-400'}`} title={title} />
    </div>
  )
}
