import { Activity, BellRing, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

const tabs = ['Người dùng', 'Ngưỡng cảnh báo', 'Luật tự động', 'Nhật ký thao tác'] as const
type Tab = typeof tabs[number]

const users = [
  ['Khánh', 'khanh.manager', 'Manager', 'Hoạt động'],
  ['Giang', 'giang.user', 'User', 'Hoạt động'],
  ['Hoàng', 'hoang.tech', 'Technician', 'Hoạt động'],
  ['Linh', 'linh.user', 'User', 'Tạm khóa'],
]

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Người dùng')
  const [notice, setNotice] = useState('')

  return (
    <section>
      <div className="flex items-start gap-3"><ShieldCheck aria-hidden="true" className="mt-1 size-6 text-violet-300" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Manager only · Mock data</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Quản trị hệ thống</h1><p className="mt-2 text-sm text-slate-400">Quản lý người dùng, ngưỡng cảnh báo, luật AUTO và nhật ký thao tác.</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-800 pb-4">{tabs.map((tab) => <button aria-pressed={activeTab === tab} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/40' : 'text-slate-400 hover:bg-slate-800'}`} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab}</button>)}</div>
      {notice ? <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}
      <div className="mt-5">{activeTab === 'Người dùng' ? <UsersPanel onAction={() => setNotice('Demo: thay đổi người dùng được ghi nhận cục bộ, chưa gửi Backend.')} /> : null}{activeTab === 'Ngưỡng cảnh báo' ? <ThresholdPanel onAction={() => setNotice('Demo: ngưỡng cảnh báo đã được lưu cục bộ.')} /> : null}{activeTab === 'Luật tự động' ? <RulePanel onAction={() => setNotice('Demo: luật AUTO đã được bật/tắt cục bộ.')} /> : null}{activeTab === 'Nhật ký thao tác' ? <AuditPanel /> : null}</div>
    </section>
  )
}

function UsersPanel({ onAction }: { onAction: () => void }) { return <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold text-slate-100">Danh sách người dùng</h2><p className="mt-1 text-xs text-slate-500">Chỉ Manager được thêm hoặc đổi vai trò.</p></div><button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950" onClick={onAction} type="button">+ Thêm người dùng</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Họ và tên</th><th className="pb-3">Tài khoản</th><th className="pb-3">Vai trò</th><th className="pb-3">Trạng thái</th><th className="pb-3">Thao tác</th></tr></thead><tbody>{users.map(([name, account, role, status]) => <tr className="border-b border-slate-800/80" key={account}><td className="py-3 font-semibold text-slate-100">{name}</td><td className="text-slate-400">{account}</td><td><span className="rounded border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-xs text-violet-200">{role}</span></td><td className={status === 'Hoạt động' ? 'text-emerald-300' : 'text-slate-400'}>{status}</td><td><button className="text-xs font-semibold text-cyan-300 hover:text-cyan-100" onClick={onAction} type="button">Chỉnh sửa</button></td></tr>)}</tbody></table></div></section> }
function ThresholdPanel({ onAction }: { onAction: () => void }) { return <Panel icon={BellRing} title="Ngưỡng cảnh báo"><div className="grid gap-3 sm:grid-cols-2">{[['Nhiệt độ tối đa', '32 °C'], ['Độ ẩm tối đa', '70 %'], ['Ánh sáng tối thiểu', '200 lux'], ['MQ135 cảnh báo', 'Vượt ngưỡng']].map(([label, value]) => <label className="text-sm text-slate-300" key={label}>{label}<input className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-slate-100" defaultValue={value} /></label>)}</div><button className="mt-5 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950" onClick={onAction} type="button">Lưu ngưỡng (demo)</button></Panel> }
function RulePanel({ onAction }: { onAction: () => void }) { return <Panel icon={Activity} title="Luật vận hành AUTO"><div className="space-y-3">{['Nếu nhiệt độ > 30 °C → bật Quạt', 'Nếu độ ẩm < 45 % → bật Máy cấp ẩm', 'Nếu ánh sáng < 200 lux → bật Đèn chiếu'].map((rule) => <label className="flex items-center justify-between rounded-lg border border-slate-700 p-3 text-sm text-slate-200" key={rule}>{rule}<input aria-label={`Bật ${rule}`} defaultChecked type="checkbox" /></label>)}</div><button className="mt-5 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950" onClick={onAction} type="button">Cập nhật luật (demo)</button></Panel> }
function AuditPanel() { return <Panel icon={Activity} title="Nhật ký thao tác"><ul className="space-y-3 text-sm"><li className="text-slate-300"><span className="font-mono text-xs text-slate-500">22:20</span> Khánh đổi chế độ MANUAL.</li><li className="text-slate-300"><span className="font-mono text-xs text-slate-500">21:58</span> Hoàng xác nhận trạng thái Gateway.</li><li className="text-slate-300"><span className="font-mono text-xs text-slate-500">20:05</span> Linh đăng nhập hệ thống.</li></ul></Panel> }
function Panel({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5"><div className="flex items-center gap-2"><Icon aria-hidden="true" className="size-5 text-violet-300" /><h2 className="font-bold text-slate-100">{title}</h2></div><div className="mt-5">{children}</div></section> }
