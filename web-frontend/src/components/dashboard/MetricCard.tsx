import type { LucideIcon } from 'lucide-react'
import type { EnvironmentMetric, MetricTone } from '../../types/dashboard'

const toneClasses: Record<MetricTone, string> = {
  cyan: 'border-cyan-400/35 bg-cyan-400/10 text-cyan-300',
  violet: 'border-violet-400/35 bg-violet-400/10 text-violet-300',
  amber: 'border-amber-400/35 bg-amber-400/10 text-amber-300',
  emerald: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  rose: 'border-rose-400/35 bg-rose-400/10 text-rose-300',
}

interface MetricCardProps {
  metric: EnvironmentMetric
  icon: LucideIcon
}

export function MetricCard({ metric, icon: Icon }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-100">{metric.value}</p>
        </div>
        <span className={`grid size-9 place-items-center rounded-lg border ${toneClasses[metric.tone]}`}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{metric.source}</p>
      <p className="mt-1 text-xs font-medium text-emerald-300">{metric.trend}</p>
    </article>
  )
}
