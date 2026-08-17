import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { alerts } from '../data/mockDashboard'
import type { AlertItem } from '../types/dashboard'

const severityConfig = {
  warning: { label: 'Cảnh báo', tone: 'border-amber-400/40 bg-amber-400/10 text-amber-200', icon: CircleAlert },
  info: { label: 'Thông tin', tone: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200', icon: Info },
  success: { label: 'Đã xử lý', tone: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200', icon: CheckCircle2 },
}

export function AlertsPage() {
  const [selected, setSelected] = useState<AlertItem | null>(null)
  const [filter, setFilter] = useState<'all' | AlertItem['severity']>('all')
  const visibleAlerts = useMemo(() => filter === 'all' ? alerts : alerts.filter((alert) => alert.severity === filter), [filter])

  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Giám sát sự kiện · Mock data</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Cảnh báo & lịch sử sự kiện</h1>
        <p className="mt-2 text-sm text-slate-400">Theo dõi, xác nhận và xử lý các cảnh báo tại phòng P.101.</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Nghiêm trọng" value="0" tone="text-rose-300" />
        <SummaryCard label="Cảnh báo" value="1" tone="text-amber-300" />
        <SummaryCard label="Thông tin" value="3" tone="text-cyan-300" />
        <SummaryCard label="Đã xử lý" value="12" tone="text-emerald-300" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Lọc cảnh báo">
        {([['all', 'Tất cả'], ['warning', 'Cảnh báo'], ['info', 'Thông tin'], ['success', 'Đã xử lý']] as const).map(([key, label]) => <button aria-pressed={filter === key} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400'}`} key={key} onClick={() => setFilter(key)} type="button">{label}</button>)}
      </div>
      <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
        <h2 className="text-base font-bold text-slate-100">Danh sách cảnh báo</h2>
        <table className="mt-4 w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Thời gian</th><th className="pb-3">Mức độ</th><th className="pb-3">Nguồn</th><th className="pb-3">Nội dung</th><th className="pb-3">Trạng thái</th><th className="pb-3">Thao tác</th></tr></thead>
          <tbody>{visibleAlerts.map((alert) => { const config = severityConfig[alert.severity]; return <tr className="border-b border-slate-800/80" key={alert.id}><td className="py-4 font-mono text-xs text-slate-400">{alert.time}</td><td><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${config.tone}`}>{config.label}</span></td><td className="text-slate-200">{alert.id === 'signal' ? 'NODE-NE' : alert.id === 'auto' ? 'Rule Engine' : 'Gateway'}</td><td className="text-slate-300">{alert.message}</td><td className="text-slate-400">{alert.severity === 'warning' ? 'Chưa xử lý' : 'Đã đọc'}</td><td><button className="rounded-md border border-cyan-400/50 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10" onClick={() => setSelected(alert)} type="button">Chi tiết</button></td></tr> })}</tbody>
        </table>
      </section>
      {selected ? <AlertDialog alert={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) { return <article className="rounded-xl border border-slate-800 bg-[#0c1d37] p-4"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p><p className="mt-1 text-xs text-slate-500">7 ngày qua</p></article> }

function AlertDialog({ alert, onClose }: { alert: AlertItem; onClose: () => void }) {
  const config = severityConfig[alert.severity]
  const Icon = config.icon
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="presentation"><section aria-label="Chi tiết cảnh báo" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1d37] p-5 shadow-2xl" role="dialog"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Icon aria-hidden="true" className="size-6 text-amber-300" /><div><h2 className="font-bold text-slate-100">Chi tiết cảnh báo</h2><p className="mt-1 text-xs text-slate-500">{alert.time}</p></div></div><button aria-label="Đóng cửa sổ chi tiết" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" onClick={onClose} type="button"><X className="size-5" /></button></div><div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/25 p-4"><p className="text-sm font-semibold text-slate-100">{alert.title}</p><p className="mt-2 text-sm leading-6 text-slate-300">{alert.message}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Nguồn</dt><dd className="mt-1 text-slate-200">{alert.id === 'signal' ? 'NODE-NE' : 'Hệ thống'}</dd></div><div><dt className="text-slate-500">Mức độ</dt><dd className="mt-1 text-slate-200">{config.label}</dd></div></dl></div><button className="mt-5 w-full rounded-lg bg-cyan-400 px-3 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300" onClick={onClose} type="button">Đánh dấu đã đọc</button></section></div>
}
