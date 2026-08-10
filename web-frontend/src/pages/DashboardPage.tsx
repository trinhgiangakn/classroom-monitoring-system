import { Droplets, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AlertList } from '../components/dashboard/AlertList'
import { EnvironmentChart } from '../components/dashboard/EnvironmentChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { NodeCard } from '../components/dashboard/NodeCard'
import { QuickControls } from '../components/dashboard/QuickControls'
import { alerts, environmentSeries as fallbackSeries, metrics as fallbackMetrics, sensorNodes as fallbackNodes } from '../data/mockDashboard'
import { getLatestSensors, getNodes, getSensorHistory } from '../services/dev2Api'
import { toHistoryPoints, toMetrics, toSensorNodes } from '../services/dev2Adapters'
import type { EnvironmentMetric, EnvironmentPoint, SensorNode } from '../types/dashboard'

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      getLatestSensors(),
      getSensorHistory({ timeRange: '6h' }),
      getNodes(),
    ]).then(([latest, history, nodeRows]) => {
      if (!active) return
      const liveSeries = toHistoryPoints(history.series)
      setMetrics(toMetrics(latest))
      setSeries(liveSeries.length ? liveSeries : fallbackSeries)
      setNodes(toSensorNodes(nodeRows, latest))
      setError(null)
    }).catch((reason: unknown) => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu Dev2')
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => { active = false }
  }, [])

  const onlineNodes = nodes.filter(node => node.status === 'Online' || node.status === 'Tín hiệu yếu').length

  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Web Dashboard · {loading ? 'Đang tải API' : error ? 'Dữ liệu dự phòng' : 'Live API Dev2'}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Tổng quan phòng P.101</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Dữ liệu từ 4 node STM32F401RE: AHT20, BMP280, BH1750 và MQ135.</p>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          Chu kỳ telemetry: <strong>5 giây</strong> · Mục tiêu lệnh: <strong>≤ 3 giây</strong>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
          Không tải được API Dev2: {error}. Dashboard đang dùng dữ liệu dự phòng.
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
        Phòng P.101 · Cảm biến, node và biểu đồ lấy từ REST API Dev2; điều khiển nhanh và cảnh báo vẫn thuộc module khác.
      </p>
    </>
  )
}
