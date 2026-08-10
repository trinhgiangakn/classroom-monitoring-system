import { Activity, Database, Radio, Router, Server, Signal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sensorNodes as fallbackNodes } from '../data/mockDashboard'
import { getGatewayStatus, getLatestSensors, getNodes } from '../services/dev2Api'
import { toGatewayRuntime, toSensorNodes } from '../services/dev2Adapters'
import type { GatewayRuntime, SensorNode } from '../types/dashboard'

export function SystemStatusPage() {
  const [nodes, setNodes] = useState<SensorNode[]>(fallbackNodes)
  const [gateway, setGateway] = useState<GatewayRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getNodes(), getLatestSensors(), getGatewayStatus()])
      .then(([nodeRows, latest, gatewayRow]) => {
        if (!active) return
        setNodes(toSensorNodes(nodeRows, latest))
        setGateway(toGatewayRuntime(gatewayRow))
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Không thể tải trạng thái hệ thống')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const apiOnline = !loading && !error
  const services = [
    { label: 'MQTT Broker', detail: 'Trạng thái do ESP32 Gateway báo cáo', icon: Radio, online: gateway?.mqttConnected ?? false },
    { label: 'ESP32 Gateway', detail: gateway ? `${gateway.gatewayId} · RSSI ${gateway.wifiSignalDbm ?? '—'} dBm` : 'Chưa nhận trạng thái', icon: Router, online: gateway?.status === 'Online' },
    { label: 'Node.js Backend', detail: 'REST API Dev1 + Dev2', icon: Server, online: apiOnline },
    { label: 'MySQL Database', detail: 'Telemetry · Users · Logs', icon: Database, online: apiOnline },
  ]

  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Theo dõi kỹ thuật · {loading ? 'Đang tải API' : error ? 'Dữ liệu dự phòng' : 'Live API Dev2'}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Trạng thái hệ thống</h1>
        <p className="mt-2 text-sm text-slate-400">Kết nối node, gateway và dịch vụ máy chủ của phòng P.101.</p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Không tải được trạng thái thật: {error}. Node đang hiển thị dữ liệu dự phòng; dịch vụ được đánh dấu Offline.
        </p>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ label, detail, icon: Icon, online }) => (
          <article className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4" key={label}>
            <Icon aria-hidden="true" className="size-5 text-cyan-300" />
            <p className="mt-4 font-bold text-slate-100">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
            <p className={`mt-4 text-sm font-semibold ${online ? 'text-emerald-300' : 'text-rose-300'}`}>● {online ? 'Online' : 'Offline'}</p>
          </article>
        ))}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.8fr)]">
        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Signal aria-hidden="true" className="size-5 text-cyan-300" />
            <div><h2 className="font-bold text-slate-100">Tình trạng node cảm biến</h2><p className="mt-1 text-xs text-slate-500">BLE advertising theo chu kỳ 5 giây</p></div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[550px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Node</th><th className="pb-3">RSSI</th><th className="pb-3">Lần cuối</th><th className="pb-3">Sensors</th><th className="pb-3">Trạng thái</th></tr></thead>
              <tbody>{nodes.map(node => (
                <tr className="border-b border-slate-800/80" key={node.id}>
                  <td className="py-3 font-semibold text-slate-100">{node.id}</td>
                  <td className={(node.signalDbm ?? -128) < -75 ? 'text-amber-300' : 'text-emerald-300'}>{node.signalDbm === null ? '—' : `${node.signalDbm} dBm`}</td>
                  <td className="text-slate-400">{node.lastSeen}</td>
                  <td className="text-slate-300">AHT20 · BMP280 · BH1750 · MQ135</td>
                  <td className={node.status === 'Online' ? 'text-emerald-300' : 'text-amber-300'}>{node.status}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
          <div className="flex items-center gap-2"><Activity aria-hidden="true" className="size-5 text-violet-300" /><h2 className="font-bold text-slate-100">Chỉ số vận hành Gateway</h2></div>
          <div className="mt-5 space-y-5">
            <Progress label="Gateway CPU" value={gateway?.cpuUsagePercent} tone="bg-cyan-400" />
            <Progress label="Gateway RAM heap" value={gateway?.ramHeapPercent} tone="bg-violet-400" />
            <Progress label="MQTT queue" value={gateway?.mqttQueuePercent} tone="bg-emerald-400" />
          </div>
          <div className="mt-6 rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-100">
            <p className="font-bold">Gateway {gateway?.gatewayId ?? 'chưa xác định'}</p>
            <p className="mt-1 text-xs">Cập nhật {gateway?.lastSeen ?? 'chưa có dữ liệu'} · Wi-Fi {gateway?.wifiConnected ? 'đã kết nối' : 'mất kết nối'}.</p>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
        <h2 className="font-bold text-slate-100">Nhật ký trạng thái hiện tại</h2>
        <div className="mt-4 space-y-2 font-mono text-xs">
          <p className={gateway?.mqttConnected ? 'text-emerald-300' : 'text-rose-300'}>MQTT {gateway?.mqttConnected ? 'connected' : 'disconnected'}</p>
          <p className={gateway?.wifiConnected ? 'text-cyan-200' : 'text-rose-300'}>Gateway Wi-Fi {gateway?.wifiConnected ? 'connected' : 'disconnected'}</p>
          <p className="text-slate-400">{nodes.length} sensor node được Backend Dev2 trả về</p>
        </div>
      </section>
    </section>
  )
}

function Progress({ label, value, tone }: { label: string; value: number | null | undefined; tone: string }) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0))
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-mono text-slate-400">{value === null || value === undefined ? '—' : `${value}%`}</span></div>
      <div className="mt-2 h-2 rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone}`} style={{ width: `${safeValue}%` }} /></div>
    </div>
  )
}
