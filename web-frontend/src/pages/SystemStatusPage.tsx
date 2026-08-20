import { Activity, Database, Radio, RefreshCw, Router, Server, Signal } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  getGatewayStatus,
  getLatestSensors,
  getNodes,
  getSystemHealth,
  type SystemHealthDto,
} from '../services/dev2Api'
import { toGatewayRuntime, toSensorNodes } from '../services/dev2Adapters'
import {
  subscribeToConnection,
  subscribeToRealtime,
  SYSTEM_REALTIME_EVENTS,
  type RealtimeConnectionState,
} from '../services/socket'
import type { GatewayRuntime, SensorNode } from '../types/dashboard'

const SYSTEM_REFRESH_INTERVAL_MS = 15_000

function classifyNode(node: SensorNode) {
  const reported = node.status.toLowerCase()
  if (reported.includes('offline') || node.lastSeen.toLowerCase().includes('chưa')) return 'Offline'
  if (node.signalDbm === null) return 'Offline'
  if (node.signalDbm < -75) return 'Tín hiệu yếu'
  return 'Online'
}

export function SystemStatusPage() {
  const [nodes, setNodes] = useState<SensorNode[]>([])
  const [gateway, setGateway] = useState<GatewayRuntime | null>(null)
  const [health, setHealth] = useState<SystemHealthDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connection, setConnection] = useState<RealtimeConnectionState>('disconnected')
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    const [nodeResult, latestResult, gatewayResult, healthResult] = await Promise.allSettled([
      getNodes(),
      getLatestSensors(),
      getGatewayStatus(),
      getSystemHealth(),
    ])
    const failures: string[] = []

    if (nodeResult.status === 'fulfilled' && latestResult.status === 'fulfilled') {
      setNodes(toSensorNodes(nodeResult.value, latestResult.value).map(node => ({ ...node, status: classifyNode(node) })))
    } else {
      failures.push('Không tải được trạng thái node')
    }
    if (gatewayResult.status === 'fulfilled' && gatewayResult.value) {
      setGateway(toGatewayRuntime(gatewayResult.value))
      setGatewayReachable(true)
    } else {
      setGatewayReachable(false)
      failures.push('Không tải được trạng thái Gateway')
    }
    if (healthResult.status === 'fulfilled' && healthResult.value) {
      setHealth(healthResult.value)
      setBackendReachable(true)
    } else {
      setBackendReachable(false)
      failures.push('Backend không phản hồi')
    }
    setLastUpdated(new Date())
    setError(failures.length > 0 ? failures.join(' · ') : null)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const interval = window.setInterval(() => { void load() }, SYSTEM_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])
  useEffect(() => {
    let pending: number | undefined
    const unsubscribe = subscribeToRealtime(SYSTEM_REALTIME_EVENTS, () => {
      window.clearTimeout(pending)
      pending = window.setTimeout(() => { void load() }, 750)
    })
    return () => { window.clearTimeout(pending); unsubscribe() }
  }, [load])
  useEffect(() => subscribeToConnection(setConnection), [])

  const backendOnline = backendReachable === null ? null : backendReachable
  const databaseOnline = backendReachable
    ? health?.services?.database?.connected ?? false
    : null
  const mqttOnline = backendReachable
    ? health?.services?.mqtt?.connected ?? health?.mqtt_connected ?? false
    : null
  const services = [
    { label: 'MQTT Broker', detail: 'Kết nối broker từ Backend', icon: Radio, online: mqttOnline },
    { label: 'ESP32 Gateway', detail: gateway ? `${gateway.gatewayId} · RSSI ${gateway.wifiSignalDbm ?? '—'} dBm` : 'Chưa nhận trạng thái', icon: Router, online: gatewayReachable ? gateway?.status === 'Online' : null },
    { label: 'Node.js Backend', detail: health?.service || 'REST API', icon: Server, online: backendOnline },
    { label: 'MySQL Database', detail: 'Health query SELECT 1', icon: Database, online: databaseOnline },
  ]

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Theo dõi kỹ thuật · {loading ? 'Đang tải API' : 'Live API + Socket.io'}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Trạng thái hệ thống</h1>
          <p className="mt-2 text-sm text-slate-400">Kết nối node, gateway và dịch vụ máy chủ của phòng P.101.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Tự kiểm tra mỗi 15 giây</span>
          <button aria-label="Làm mới trạng thái" className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60" disabled={refreshing} onClick={() => void load()} type="button"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Đang làm mới…' : 'Làm mới'}</button>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">Không tải được trạng thái thật: {error}. Dữ liệu thành công gần nhất được giữ nguyên.</p> : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ label, detail, icon: Icon, online }) => (
          <article className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4" key={label}>
            <Icon aria-hidden="true" className="size-5 text-cyan-300" />
            <p className="mt-4 font-bold text-slate-100">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
            <p className={`mt-4 text-sm font-semibold ${online === null ? 'text-slate-400' : online ? 'text-emerald-300' : 'text-rose-300'}`}>● {online === null ? 'Không xác định' : online ? 'Online' : 'Offline'}</p>
          </article>
        ))}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.8fr)]">
        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
          <div className="flex items-center gap-2"><Signal aria-hidden="true" className="size-5 text-cyan-300" /><div><h2 className="font-bold text-slate-100">Tình trạng node cảm biến</h2><p className="mt-1 text-xs text-slate-500">Online / Offline / Tín hiệu yếu theo RSSI và last_seen</p></div></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Node</th><th className="pb-3">RSSI</th><th className="pb-3">Lần cuối</th><th className="pb-3">Sensors</th><th className="pb-3">Trạng thái</th></tr></thead>
              <tbody>{nodes.map(node => <tr className="border-b border-slate-800/80" key={node.id}><td className="py-3 font-semibold text-slate-100">{node.id}</td><td className={node.signalDbm !== null && node.signalDbm < -75 ? 'text-amber-300' : node.signalDbm === null ? 'text-rose-300' : 'text-emerald-300'}>{node.signalDbm === null ? '—' : `${node.signalDbm} dBm`}</td><td className="text-slate-400">{node.lastSeen}</td><td className="text-slate-300">AHT20 · BMP280 · BH1750 · MQ135</td><td className={node.status === 'Online' ? 'text-emerald-300' : node.status === 'Offline' ? 'text-rose-300' : 'text-amber-300'}>{node.status}</td></tr>)}</tbody>
            </table>
            {!loading && nodes.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Chưa có node cảm biến.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
          <div className="flex items-center gap-2"><Activity aria-hidden="true" className="size-5 text-violet-300" /><h2 className="font-bold text-slate-100">Chỉ số vận hành Gateway</h2></div>
          <div className="mt-5 space-y-5"><Progress label="Gateway CPU" value={gateway?.cpuUsagePercent} tone="bg-cyan-400" /><Progress label="Gateway RAM heap" value={gateway?.ramHeapPercent} tone="bg-violet-400" /><Progress label="MQTT queue" value={gateway?.mqttQueuePercent} tone="bg-emerald-400" /></div>
          <div className="mt-6 rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-100"><p className="font-bold">Gateway {gateway?.gatewayId ?? 'chưa xác định'}</p><p className="mt-1 text-xs">Cập nhật {gateway?.lastSeen ?? 'chưa có dữ liệu'} · Wi-Fi {gateway?.wifiConnected ? 'đã kết nối' : 'mất kết nối'}.</p></div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-100">Nhật ký kết nối hiện tại</h2><span className="text-xs text-slate-500">Cập nhật: {lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN') : 'chưa có'}</span></div>
        <div className="mt-4 space-y-2 font-mono text-xs">
          <p className={connection === 'connected' ? 'text-emerald-300' : connection === 'connecting' ? 'text-amber-300' : 'text-rose-300'}>Socket.io {connection}</p>
          <p className={mqttOnline === null ? 'text-slate-400' : mqttOnline ? 'text-emerald-300' : 'text-rose-300'}>MQTT {mqttOnline === null ? 'unknown' : mqttOnline ? 'connected' : 'disconnected'}</p>
          <p className={gateway?.wifiConnected ? 'text-cyan-200' : 'text-rose-300'}>Gateway Wi-Fi {gateway?.wifiConnected ? 'connected' : 'disconnected'}</p>
          <p className="text-slate-400">{nodes.length} sensor node được Backend trả về</p>
        </div>
      </section>
    </section>
  )
}

function Progress({ label, value, tone }: { label: string; value: number | null | undefined; tone: string }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0))
  return <div><div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-mono text-slate-400">{value === null || value === undefined ? '—' : `${value}%`}</span></div><div className="mt-2 h-2 rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone}`} style={{ width: `${safeValue}%` }} /></div></div>
}
