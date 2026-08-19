import {
  Bell,
  ChartNoAxesCombined,
  LayoutDashboard,
  MonitorCog,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigationItems = [
  { label: 'Tổng quan', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Giám sát dữ liệu', icon: ChartNoAxesCombined, to: '/monitoring' },
  { label: 'Điều khiển thiết bị', icon: SlidersHorizontal, to: '/devices' },
  { label: 'Cảnh báo', icon: Bell, badge: '1', to: '/alerts' },
  { label: 'Trạng thái hệ thống', icon: MonitorCog, to: '/system-status' },
  { label: 'Quản trị', icon: Settings, to: '/admin' },
]

import { useEffect, useState } from 'react'
import { getGatewayStatus } from '../../services/dev2Api'

export function Sidebar() {
  const [gatewayOnline, setGatewayOnline] = useState(false)
  const [mqttOnline, setMqttOnline] = useState(false)

  useEffect(() => {
    let active = true
    const check = () => {
      getGatewayStatus()
        .then(gw => {
          if (!active || !gw) return
          const rawStatus = (gw.status || '').toUpperCase()
          setGatewayOnline(rawStatus === 'ONLINE')
          setMqttOnline(Boolean(gw.mqtt_connected))
        })
        .catch(() => {
          if (active) {
            setGatewayOnline(false)
          }
        })

      fetch('/api/health')
        .then(r => r.json())
        .then(h => {
          if (active && h && typeof h.mqtt_connected === 'boolean') {
            setMqttOnline(prev => h.mqtt_connected || prev)
          }
        })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, 5000)
    return () => { active = false; clearInterval(id) }
  }, [])

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-[#08182e] lg:min-h-screen lg:w-64 lg:border-r lg:border-b-0">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 font-bold text-cyan-300">
          CM
        </div>
        <div>
          <p className="text-sm font-bold tracking-wide text-cyan-300">Classroom Monitoring</p>
          <p className="text-xs text-slate-400">Giám sát & điều khiển</p>
        </div>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-cyan-400/20 bg-slate-950/30 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phòng học</p>
        <p className="mt-1 text-sm font-semibold text-cyan-200">P.101</p>
      </div>

      <nav aria-label="Điều hướng dashboard" className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-col lg:overflow-visible">
        {navigationItems.map(({ label, icon: Icon, to, badge }) => (
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
            {badge ? (
              <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                {badge}
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
          <StatusLine label="Cơ sở dữ liệu" online={true} />
        </div>
      </div>
    </aside>
  )
}

function StatusLine({ label, online = true }: { label: string; online?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span
        className={`size-2 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-rose-500/80'}`}
        title={online ? 'Online' : 'Offline'}
      />
    </div>
  )
}
