import { CheckCircle2, CircleAlert, EyeOff, RotateCcw, ShieldAlert, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  acknowledgeAlert,
  deleteAlert,
  dismissResolvedAlerts,
  getAlerts,
  getAlertSummary,
  resolveAlert,
  restoreDismissedAlert,
  type AlertDto,
  type AlertSeverity,
  type AlertStatus,
  type AlertSummaryDto,
  type AlertVisibility,
} from '../services/alertApi'
import { getUserRole } from '../lib/api'
import { ALERT_REALTIME_EVENTS, subscribeToRealtime } from '../services/socket'

type FilterKey = 'all' | 'critical' | 'warning' | 'resolved' | 'dismissed'

const emptySummary: AlertSummaryDto = { critical: 0, warning: 0, resolved: 0, unresolved: 0, total: 0 }
const severityConfig = {
  CRITICAL: { label: 'Nghiêm trọng', tone: 'border-rose-400/40 bg-rose-400/10 text-rose-200', icon: ShieldAlert },
  WARNING: { label: 'Cảnh báo', tone: 'border-amber-400/40 bg-amber-400/10 text-amber-200', icon: CircleAlert },
} satisfies Record<AlertSeverity, { label: string; tone: string; icon: typeof ShieldAlert }>

function filterParams(filter: FilterKey): { severity?: AlertSeverity; status?: AlertStatus; visibility?: AlertVisibility } {
  if (filter === 'resolved') return { status: 'RESOLVED' }
  if (filter === 'dismissed') return { visibility: 'dismissed' }
  if (filter === 'all') return {}
  return { severity: filter.toUpperCase() as AlertSeverity }
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertDto[]>([])
  const [summary, setSummary] = useState(emptySummary)
  const [selected, setSelected] = useState<AlertDto | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingBulkDismiss, setConfirmingBulkDismiss] = useState(false)
  const userRole = getUserRole()
  const isAdmin = userRole === 'admin'
  const canManageAlerts = userRole === 'admin' || userRole === 'technician'

  const load = useCallback(async () => {
    try {
      const [items, totals] = await Promise.all([getAlerts(filterParams(filter)), getAlertSummary()])
      setAlerts(items)
      setSummary(totals)
      setSelected(current => current ? items.find(item => item.id === current.id) ?? null : null)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải cảnh báo')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { setLoading(true); void load() }, [load])
  useEffect(() => subscribeToRealtime(ALERT_REALTIME_EVENTS, () => { void load() }), [load])

  const summaryCards = useMemo(() => [
    { label: 'Nghiêm trọng', value: summary.critical, tone: 'text-rose-300' },
    { label: 'Cảnh báo', value: summary.warning, tone: 'text-amber-300' },
    { label: 'Đã xử lý', value: summary.resolved, tone: 'text-emerald-300' },
  ], [summary])

  async function updateAlert(action: 'acknowledge' | 'resolve') {
    if (!selected) return
    try {
      const updated = action === 'acknowledge'
        ? await acknowledgeAlert(selected.id)
        : await resolveAlert(selected.id)
      setSelected(updated)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật cảnh báo')
    }
  }

  async function restoreSelected() {
    if (!selected) return
    try {
      await restoreDismissedAlert(selected.id)
      setSelected(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật danh sách cảnh báo')
    }
  }

  async function removeSelected() {
    if (!selected) return
    try {
      await deleteAlert(selected.id)
      setSelected(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa cảnh báo')
    }
  }

  async function dismissAllResolved() {
    try {
      await dismissResolvedAlerts()
      setConfirmingBulkDismiss(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể ẩn các cảnh báo đã xử lý')
    }
  }

  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Giám sát sự kiện · Live API</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Cảnh báo & lịch sử sự kiện</h1>
        <p className="mt-2 text-sm text-slate-400">Theo dõi, xác nhận và xử lý các cảnh báo tại phòng P.101.</p>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map(card => <SummaryCard key={card.label} {...card} />)}
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Lọc cảnh báo">
        {([['all', 'Tất cả'], ['critical', 'Nghiêm trọng'], ['warning', 'Cảnh báo'], ['resolved', 'Đã xử lý'], ['dismissed', 'Đã ẩn']] as const).map(([key, label]) => (
          <button aria-pressed={filter === key} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`} key={key} onClick={() => setFilter(key)} type="button">{label}</button>
        ))}
        <button className="ml-auto flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40" disabled={summary.resolved === 0} onClick={() => setConfirmingBulkDismiss(true)} type="button"><EyeOff className="size-4" />Ẩn tất cả đã xử lý</button>
      </div>

      {confirmingBulkDismiss ? <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3"><div className="mr-auto"><p className="text-sm font-bold text-amber-200">Ẩn {summary.resolved} cảnh báo đã xử lý?</p><p className="mt-1 text-xs text-amber-200/75">Chỉ tài khoản của bạn bị ẩn. Có thể khôi phục trong mục Đã ẩn.</p></div><button className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300" onClick={() => setConfirmingBulkDismiss(false)} type="button">Hủy</button><button className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300" onClick={() => void dismissAllResolved()} type="button">Xác nhận ẩn tất cả</button></div> : null}

      <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-100">Danh sách cảnh báo</h2>
          <span className="text-xs text-slate-500">{loading ? 'Đang tải…' : `${alerts.length} kết quả`}</span>
        </div>
        <table className="mt-4 w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Thời gian</th><th className="pb-3">Mức độ</th><th className="pb-3">Nguồn</th><th className="pb-3">Nội dung</th><th className="pb-3">Trạng thái</th><th className="pb-3">Thao tác</th></tr></thead>
          <tbody>
            {alerts.map(alert => {
              const config = severityConfig[alert.severity]
              return <tr className="border-b border-slate-800/80" key={alert.id}><td className="py-4 font-mono text-xs text-slate-400">{formatDate(alert.created_at)}</td><td><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${config.tone}`}>{config.label}</span></td><td className="text-slate-200">{alert.source}</td><td className="max-w-sm truncate pr-4 text-slate-300">{alert.message}</td><td><StatusBadge status={alert.status} /></td><td><button className="rounded-md border border-cyan-400/50 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10" onClick={() => setSelected(alert)} type="button">Chi tiết</button></td></tr>
            })}
          </tbody>
        </table>
        {!loading && alerts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Không có cảnh báo phù hợp bộ lọc.</p> : null}
      </section>
      {selected ? <AlertDialog alert={selected} dismissed={filter === 'dismissed'} isAdmin={isAdmin} canManageAlerts={canManageAlerts} onAcknowledge={() => void updateAlert('acknowledge')} onClose={() => setSelected(null)} onDelete={() => void removeSelected()} onResolve={() => void updateAlert('resolve')} onRestore={() => void restoreSelected()} /> : null}
    </section>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Asia/Bangkok',
    hour12: false,
  }).format(date)
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <article className="rounded-xl border border-slate-800 bg-[#0c1d37] p-4"><p className="text-sm text-slate-400">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p><p className="mt-1 text-xs text-slate-500">Dữ liệu hiện tại</p></article>
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles = status === 'RESOLVED' ? 'text-emerald-300' : status === 'ACKNOWLEDGED' ? 'text-cyan-300' : 'text-amber-300'
  const label = status === 'RESOLVED' ? 'Đã xử lý' : status === 'ACKNOWLEDGED' ? 'Đã tiếp nhận' : 'Mới'
  return <span className={`text-xs font-semibold ${styles}`}>{label}</span>
}

function AlertDialog({ alert, dismissed, isAdmin, canManageAlerts, onAcknowledge, onClose, onDelete, onResolve, onRestore }: { alert: AlertDto; dismissed: boolean; isAdmin: boolean; canManageAlerts: boolean; onAcknowledge: () => void; onClose: () => void; onDelete: () => void; onResolve: () => void; onRestore: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const config = severityConfig[alert.severity]
  const Icon = alert.status === 'RESOLVED' ? CheckCircle2 : config.icon
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4" role="presentation"><section aria-label="Chi tiết cảnh báo" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0c1d37] p-5 shadow-2xl" role="dialog"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Icon aria-hidden="true" className="size-6 text-amber-300" /><div><h2 className="font-bold text-slate-100">Chi tiết cảnh báo</h2><p className="mt-1 text-xs text-slate-500">{formatDate(alert.created_at)}</p></div></div><button aria-label="Đóng cửa sổ chi tiết" className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" onClick={onClose} type="button"><X className="size-5" /></button></div><div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/25 p-4"><p className="text-sm font-semibold text-slate-100">{alert.source}</p><p className="mt-2 text-sm leading-6 text-slate-300">{alert.message}</p><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Nguồn</dt><dd className="mt-1 text-slate-200">{alert.source}</dd></div><div><dt className="text-slate-500">Mức độ</dt><dd className="mt-1 text-slate-200">{config.label}</dd></div><div><dt className="text-slate-500">Phòng</dt><dd className="mt-1 text-slate-200">{alert.room_id}</dd></div><div><dt className="text-slate-500">Trạng thái</dt><dd className="mt-1"><StatusBadge status={alert.status} /></dd></div></dl></div>{confirmingDelete ? <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-400/10 p-3"><p className="text-sm font-bold text-rose-200">Xóa cảnh báo khỏi danh sách chung?</p><p className="mt-1 text-xs text-rose-200/80">Cảnh báo sẽ biến mất với tất cả người dùng nhưng vẫn được lưu trong cơ sở dữ liệu để truy vết.</p><div className="mt-3 flex gap-2"><button className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300" onClick={() => setConfirmingDelete(false)} type="button">Hủy</button><button className="flex-1 rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-white hover:bg-rose-400" onClick={onDelete} type="button">Xác nhận xóa</button></div></div> : <div className="mt-5 flex flex-wrap gap-2">{dismissed ? <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-400/50 px-3 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10" onClick={onRestore} type="button"><RotateCcw className="size-4" />Khôi phục vào danh sách</button> : canManageAlerts ? <>{alert.status === 'NEW' ? <button className="flex-1 rounded-lg border border-cyan-400/50 px-3 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/10" onClick={onAcknowledge} type="button">Xác nhận / Đã đọc</button> : null}{alert.status !== 'RESOLVED' ? <button className="flex-1 rounded-lg bg-emerald-400 px-3 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300" onClick={onResolve} type="button">Đánh dấu đã xử lý</button> : null}</> : null}{isAdmin && alert.status === 'RESOLVED' ? <button className="flex items-center justify-center gap-2 rounded-lg border border-rose-400/50 px-3 py-2.5 text-sm font-bold text-rose-200 hover:bg-rose-400/10" onClick={() => setConfirmingDelete(true)} type="button"><Trash2 className="size-4" />Xóa khỏi hệ thống</button> : null}</div>}</section></div>
}
