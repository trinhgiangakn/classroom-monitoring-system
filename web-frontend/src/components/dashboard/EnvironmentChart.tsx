import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EnvironmentPoint } from '../../types/dashboard'

export function EnvironmentChart({ data }: { data: EnvironmentPoint[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Biểu đồ môi trường</h2>
          <p className="mt-1 text-xs text-slate-500">AHT20 · 7 giờ gần nhất</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-cyan-300">● Nhiệt độ</span>
          <span className="text-violet-300">● Độ ẩm</span>
        </div>
      </div>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
            <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#091a32', border: '1px solid #334155', borderRadius: 10 }}
              labelStyle={{ color: '#cbd5e1' }}
            />
            <Line dataKey="temperature" dot={false} name="Nhiệt độ (°C)" stroke="#22d3ee" strokeWidth={3} type="monotone" />
            <Line dataKey="humidity" dot={false} name="Độ ẩm (%)" stroke="#a78bfa" strokeWidth={3} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
