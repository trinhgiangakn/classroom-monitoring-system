import { CheckCircle2, CircleAlert } from 'lucide-react'
import type { AlertItem } from '../../types/dashboard'

const styleBySeverity = {
  warning: { icon: CircleAlert, className: 'border-amber-400/35 bg-amber-400/10 text-amber-200' },
  success: { icon: CheckCircle2, className: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100' },
}

export function AlertList({ alerts }: { alerts: AlertItem[] }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-100">Cảnh báo mới nhất</h2>
          <p className="mt-1 text-xs text-slate-500">Kênh cảnh báo chính: Web Dashboard</p>
        </div>
        <span className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">3 mới</span>
      </div>

      <div className="mt-4 space-y-3">
        {alerts.map((alert) => {
          const { icon: Icon, className } = styleBySeverity[alert.severity] ?? styleBySeverity.warning
          return (
            <article className={`rounded-xl border p-3 ${className}`} key={alert.id}>
              <div className="flex gap-2">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{alert.title}</p>
                  <p className="mt-1 text-xs opacity-80">{alert.message}</p>
                  <p className="mt-2 text-[11px] opacity-60">{alert.time}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
