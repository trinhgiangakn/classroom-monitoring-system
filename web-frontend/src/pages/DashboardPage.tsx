import { Droplets, Gauge, Sun, Thermometer, Wind } from 'lucide-react'
import { AlertList } from '../components/dashboard/AlertList'
import { EnvironmentChart } from '../components/dashboard/EnvironmentChart'
import { MetricCard } from '../components/dashboard/MetricCard'
import { NodeCard } from '../components/dashboard/NodeCard'
import { QuickControls } from '../components/dashboard/QuickControls'
import { alerts, environmentSeries, metrics, roomName, sensorNodes } from '../data/mockDashboard'

const metricIcons = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  light: Sun,
  'air-quality': Wind,
}

export function DashboardPage() {
  return (
    <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Web Dashboard · Demo</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Tổng quan phòng P.101</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Dữ liệu mô phỏng từ 4 node STM32F401RE: AHT20, BMP280, BH1750 và MQ135.</p>
        </div>
        <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          Chu kỳ telemetry: <strong>5 giây</strong> · Mục tiêu lệnh: <strong>≤ 3 giây</strong>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => <MetricCard icon={metricIcons[metric.id]} key={metric.id} metric={metric} />)}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.9fr)]">
        <div className="space-y-6">
          <EnvironmentChart data={environmentSeries} />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-100">Trạng thái node cảm biến</h2>
                <p className="mt-1 text-xs text-slate-500">4 node ở bốn góc phòng · BLE Advertising</p>
              </div>
              <span className="text-xs text-emerald-300">4/4 node hợp lệ</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sensorNodes.map((node) => <NodeCard key={node.id} node={node} />)}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <QuickControls />
          <AlertList alerts={alerts} />
        </div>
      </section>

      <p className="mt-6 text-xs text-slate-600">{roomName} · Bản demo UI chỉ dùng mock data. API/REST/WebSocket sẽ do Backend cung cấp ở sprint tích hợp.</p>
    </>
  )
}
