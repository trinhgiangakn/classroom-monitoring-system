import { Droplets, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AlertList } from '../components/dashboard/AlertList'
import { EnvironmentChart } from '../components/dashboard/EnvironmentChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { NodeCard } from '../components/dashboard/NodeCard'
import { QuickControls } from '../components/dashboard/QuickControls'
import { alerts as fallbackAlerts, environmentSeries as fallbackSeries, metrics as fallbackMetrics, sensorNodes as fallbackNodes } from '../data/mockDashboard'
import { getLatestSensors, getNodes, getSensorHistory } from '../services/dev2Api'
import { getAlerts, type ApiAlertItem } from '../services/adminApi'
import { toHistoryPoints, toMetrics, toSensorNodes } from '../services/dev2Adapters'
import type { EnvironmentMetric, EnvironmentPoint, SensorNode, AlertItem } from '../types/dashboard'

const metricIcons = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  light: Sun,
  'air-quality': Wind,
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<EnvironmentMetric[]>(fallbackMetrics)
  const [series, setSeries] = useState<EnvironmentPoint[]>(fallbackSeries)
  const [nodes, setNodes] = useState<SensorNode[]>(fallbackNodes)
  const [alerts, setAlerts] = useState<AlertItem[]>(fallbackAlerts)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadData = (isInitial = false) => {
      if (isInitial) setLoading(true)
      Promise.all([
        getLatestSensors(),
        getSensorHistory({ timeRange: '6h' }),
        getNodes(),
        getAlerts(3).catch(() => [] as ApiAlertItem[]),
      ]).then(([latest, history, nodeRows, alertRows]) => {
        if (!active) return
        const liveSeries = toHistoryPoints(history.series)
        setMetrics(toMetrics(latest))
        setSeries(liveSeries.length ? liveSeries : fallbackSeries)
        setNodes(toSensorNodes(nodeRows, latest))
        if (alertRows && alertRows.length > 0) {
          setAlerts(alertRows.map(a => ({
            id: a.id,
            title: a.title,
            message: a.message,
            severity: a.severity,
            time: a.time,
          })))
        }
        setError(null)
      }).catch((reason: unknown) => {
        if (!active) return
        if (isInitial) {
          setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu cảm biến')
        }
      }).finally(() => {
        if (active && isInitial) setLoading(false)
      })
    }

    loadData(true)

    // Auto-polling every 3 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(false)
      }
    }, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const onlineNodes = nodes.filter(node => node.status === 'Online' || node.status === 'Tín hiệu yếu').length

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Web Dashboard · {loading ? 'Đang tải dữ liệu' : 'Giám sát trực tiếp'}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              Live 3s
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Tổng quan phòng P.101</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Dữ liệu từ 4 node STM32F401RE: AHT20, BMP280, BH1750 và MQ135.</p>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          Chu kỳ telemetry: <strong>5 giây</strong> · Tự động làm mới: <strong>3 giây</strong>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Không kết nối được máy chủ: {error}.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(metric => <MetricCard icon={metricIcons[metric.id]} key={metric.id} metric={metric} />)}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.9fr)]">
        <div className="space-y-6">
          <EnvironmentChart data={series} />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100">Trạng thái node cảm biến</h2>
                <p className="mt-1 text-xs text-slate-500">Các node trong phòng · BLE Advertising</p>
              </div>
              <span className="text-xs text-emerald-300">{onlineNodes}/{nodes.length} node hoạt động</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {nodes.map(node => <NodeCard key={node.id} node={node} />)}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <QuickControls />
          <AlertList alerts={alerts} />
        </div>
      </section>

      <p className="mt-6 text-xs text-slate-600">
        Phòng P.101 · Dữ liệu cảm biến 4 góc phòng và điều khiển thiết bị thông minh.
      </p>
    </>
  )
}
