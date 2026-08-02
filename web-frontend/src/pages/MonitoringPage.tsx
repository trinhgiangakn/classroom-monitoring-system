import { Download, Filter, RadioTower } from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { environmentSeries, sensorNodes } from '../data/mockDashboard'

const cardClass = 'rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5'

export function MonitoringPage() {
  const [exported, setExported] = useState(false)

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Dữ liệu giả lập · 4 node hợp lệ</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Giám sát dữ liệu môi trường</h1>
          <p className="mt-2 text-sm text-slate-400">Theo dõi dữ liệu AHT20, BMP280, BH1750 và MQ135 trong phòng P.101.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20"
          onClick={() => setExported(true)}
          type="button"
        >
          <Download aria-hidden="true" className="size-4" /> Xuất CSV
        </button>
      </div>

      {exported ? (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          Demo: hệ thống sẽ xuất tệp CSV sau khi Backend cung cấp API dữ liệu.
        </p>
      ) : null}

      <section aria-label="Bộ lọc dữ liệu" className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/25 p-3 md:grid-cols-4">
        <Filter aria-hidden="true" className="m-2 size-4 text-cyan-300" />
        <Select label="Khoảng thời gian" options={['24 giờ qua', '7 ngày qua']} />
        <Select label="Node cảm biến" options={['Tất cả node', 'NODE-NW', 'NODE-NE', 'NODE-SW', 'NODE-SE']} />
        <Select label="Loại dữ liệu" options={['Tất cả chỉ số', 'Nhiệt độ', 'Độ ẩm', 'Ánh sáng', 'Chất lượng không khí']} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <section className={cardClass}>
          <h2 className="text-base font-bold text-slate-100">Nhiệt độ và độ ẩm — 24 giờ qua</h2>
          <p className="mt-1 text-xs text-slate-500">Dữ liệu tổng hợp từ 4 node hợp lệ</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={environmentSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#1e3655" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#7b91b0" tick={{ fontSize: 12 }} />
                <YAxis stroke="#7b91b0" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#07172e', border: '1px solid #28507d', borderRadius: 10 }} />
                <Line dataKey="temperature" dot={false} name="Nhiệt độ (°C)" stroke="#22d3ee" strokeWidth={3} type="monotone" />
                <Line dataKey="humidity" dot={false} name="Độ ẩm (%)" stroke="#a78bfa" strokeWidth={3} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-base font-bold text-slate-100">Cường độ ánh sáng</h2>
          <p className="mt-1 text-xs text-slate-500">BH1750 · lux theo node</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={sensorNodes} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#1e3655" strokeDasharray="3 3" />
                <XAxis dataKey="id" stroke="#7b91b0" tick={{ fontSize: 11 }} />
                <YAxis stroke="#7b91b0" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#07172e', border: '1px solid #28507d', borderRadius: 10 }} />
                <Bar dataKey="light" fill="#fbbf24" name="Ánh sáng (lux)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className={`${cardClass} mt-5 overflow-x-auto`}>
        <div className="flex items-center gap-2">
          <RadioTower aria-hidden="true" className="size-4 text-cyan-300" />
          <div>
            <h2 className="text-base font-bold text-slate-100">Bản ghi gần đây</h2>
            <p className="mt-1 text-xs text-slate-500">Mỗi node gửi telemetry theo chu kỳ 5 giây.</p>
          </div>
        </div>
        <table className="mt-4 w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-500">
            <tr><th className="pb-3">Thời gian</th><th className="pb-3">Node</th><th className="pb-3">Nhiệt độ</th><th className="pb-3">Độ ẩm</th><th className="pb-3">Ánh sáng</th><th className="pb-3">MQ135</th><th className="pb-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {sensorNodes.map((node, index) => (
              <tr className="border-b border-slate-800/80 text-slate-300" key={node.id}>
                <td className="py-3 font-mono text-xs">22:34:{55 - index * 2}</td><td className="py-3 font-semibold text-slate-100">{node.id}</td><td>{node.temperature} °C</td><td>{node.humidity} %</td><td>{node.light} lux</td><td>{node.airQuality}</td><td className={node.status === 'Online' ? 'text-emerald-300' : 'text-amber-300'}>{node.status === 'Online' ? 'Hợp lệ' : node.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  )
}

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <select className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1d37] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" defaultValue={options[0]}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}
