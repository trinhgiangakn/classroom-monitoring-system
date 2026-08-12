import { Activity, BellRing, ShieldCheck, Check, X, KeyRound } from 'lucide-react'
import { useState, useEffect } from 'react'
import { API_BASE_URL, authHeaders } from '../lib/api'

const tabs = ['Người dùng', 'Ngưỡng cảnh báo', 'Luật tự động', 'Nhật ký thao tác'] as const
type Tab = typeof tabs[number]

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Người dùng')
  const [notice, setNotice] = useState('')

  // Get the role of the currently logged-in user
  const currentUserRole = localStorage.getItem('role') || 'user' 
  const isManager = currentUserRole === 'manager' || currentUserRole === 'admin'

  return (
    <section>
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden="true" className="mt-1 size-6 text-violet-300" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            {isManager ? 'Manager only · Live Data' : 'Read only · User Mode'}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Quản trị hệ thống</h1>
          <p className="mt-2 text-sm text-slate-400">Quản lý người dùng, ngưỡng cảnh báo, luật AUTO và nhật ký thao tác.</p>
        </div>
      </div>
      
      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {tabs.map((tab) => (
          <button 
            aria-pressed={activeTab === tab} 
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${activeTab === tab ? 'bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`} 
            key={tab} 
            onClick={() => setActiveTab(tab)} 
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      
      {notice ? <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">{notice}</p> : null}
      
      <div className="mt-5">
        {activeTab === 'Người dùng' ? <UsersPanel isManager={isManager} onAction={(msg) => setNotice(msg)} /> : null}
        {activeTab === 'Ngưỡng cảnh báo' ? <ThresholdPanel onAction={() => setNotice('Demo: ngưỡng cảnh báo đã được lưu cục bộ.')} /> : null}
        {activeTab === 'Luật tự động' ? <RulePanel onAction={() => setNotice('Demo: luật AUTO đã được bật/tắt cục bộ.')} /> : null}
        {activeTab === 'Nhật ký thao tác' ? <AuditPanel /> : null}
      </div>
    </section>
  )
}

// USER TABLE (CONNECTED TO THE API)
function UsersPanel({ isManager, onAction }: { isManager: boolean, onAction: (msg: string) => void }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/admin/users`, { headers: authHeaders() })
      if (res.ok) setUsers(await res.json())
    } catch (error) {
      console.error('Lỗi lấy danh sách:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Approve a new account
  const handleApproveUser = async (email: string, status: 'approved' | 'rejected') => {
    if (!isManager) return
    try {
      const res = await fetch(`${API_BASE_URL}/auth/approve-user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target_email: email, new_status: status })
      })
      if (res.ok) {
        onAction(`Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} tài khoản ${email}`)
        fetchUsers()
      }
    } catch {
      alert('Lỗi kết nối')
    }
  }

  // Approve password reset
  const handleApproveReset = async (email: string) => {
    if (!isManager) return
    if (!window.confirm(`Gửi link đổi mật khẩu cho ${email}?`)) return
    try {
      const res = await fetch(`${API_BASE_URL}/auth/admin/approve-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ target_email: email })
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || `Đã gửi link khôi phục MK thành công cho ${email}`)
        onAction(`Đã gửi link khôi phục MK cho ${email}`)
        fetchUsers()
      } else {
        alert(data.error || data.message || 'Lỗi gửi mail!')
      }
    } catch {
      alert('Lỗi kết nối đến máy chủ Backend')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-100">Danh sách người dùng</h2>
          <p className="mt-1 text-xs text-slate-500">
            {isManager ? 'Chỉ Manager được thêm, duyệt hoặc đổi vai trò.' : 'Bạn chỉ có quyền xem danh sách này.'}
          </p>
        </div>
        {isManager && (
          <button className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300" type="button">
            + Thêm người dùng
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-500">
            <tr>
              <th className="pb-3">Họ và tên</th>
              <th className="pb-3">Tài khoản</th>
              <th className="pb-3">Vai trò</th>
              <th className="pb-3">Trạng thái</th>
              <th className="pb-3">Yêu cầu</th>
              <th className="pb-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-4 text-center text-slate-500">Đang tải dữ liệu...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="py-4 text-center text-slate-500">Chưa có người dùng nào.</td></tr>
            ) : (
              users.map((user) => (
                <tr className="border-b border-slate-800/80 last:border-0" key={user.id}>
                  <td className="py-3 font-semibold text-slate-100">{user.full_name}</td>
                  <td className="text-slate-400">{user.username}</td>
                  <td>
                    <span className="rounded border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-xs text-violet-200 capitalize">
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.status === 'approved' ? (
                      <span className="text-emerald-300 font-medium">Hoạt động</span>
                    ) : user.status === 'pending' ? (
                      <span className="text-amber-400 font-medium">Chờ duyệt</span>
                    ) : (
                      <span className="text-rose-400 font-medium">Đã khóa</span>
                    )}
                  </td>
                  <td>
                    {user.reset_requested === 1 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-rose-300 bg-rose-400/10 px-2 py-1 rounded w-fit">
                        <KeyRound className="size-3" /> Xin cấp MK
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      {/* Button to approve a new account */}
                      {user.status === 'pending' && (
                        <>
                          <button
                            disabled={!isManager}
                            onClick={() => handleApproveUser(user.email, 'approved')}
                            className="flex items-center gap-1 rounded bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check className="size-3" /> Duyệt TK
                          </button>
                          <button
                            disabled={!isManager}
                            onClick={() => handleApproveUser(user.email, 'rejected')}
                            className="flex items-center gap-1 rounded bg-rose-400/10 px-2 py-1 text-xs font-bold text-rose-400 transition hover:bg-rose-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <X className="size-3" /> Từ chối
                          </button>
                        </>
                      )}
                      
                      {/* Button to approve password recovery */}
                      {user.reset_requested === 1 && (
                        <button
                          disabled={!isManager}
                          onClick={() => handleApproveReset(user.email)}
                          className="flex items-center gap-1 rounded bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Check className="size-3" /> Cấp MK
                        </button>
                      )}
                      
                      {/* Default edit button for normal accounts */}
                      {user.status === 'approved' && user.reset_requested === 0 && (
                        <button 
                          disabled={!isManager}
                          className="text-xs font-semibold text-cyan-300 hover:text-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Chỉnh sửa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ThresholdPanel({ onAction }: { onAction: () => void }) {
  return (
    <Panel icon={BellRing} title="Ngưỡng cảnh báo">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ['Nhiệt độ tối đa', '32 °C'],
          ['Độ ẩm tối đa', '70 %'],
          ['Ánh sáng tối thiểu', '200 lux'],
          ['MQ135 cảnh báo', 'Vượt ngưỡng'],
        ].map(([label, value]) => (
          <label className="text-sm text-slate-300" key={label}>
            {label}
            <input
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-slate-100"
              defaultValue={value}
            />
          </label>
        ))}
      </div>
      <button
        className="mt-5 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950"
        onClick={onAction}
        type="button"
      >
        Lưu ngưỡng (demo)
      </button>
    </Panel>
  )
}

function RulePanel({ onAction }: { onAction: () => void }) {
  return (
    <Panel icon={Activity} title="Luật vận hành AUTO">
      <div className="space-y-3">
        {['Nếu nhiệt độ > 30 °C → bật Quạt', 'Nếu độ ẩm < 45 % → bật Máy cấp ẩm', 'Nếu ánh sáng < 200 lux → bật Đèn chiếu'].map((rule) => (
          <label className="flex items-center justify-between rounded-lg border border-slate-700 p-3 text-sm text-slate-200" key={rule}>
            {rule}
            <input aria-label={`Bật ${rule}`} defaultChecked type="checkbox" />
          </label>
        ))}
      </div>
      <button
        className="mt-5 rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950"
        onClick={onAction}
        type="button"
      >
        Cập nhật luật (demo)
      </button>
    </Panel>
  )
}

function AuditPanel() {
  return (
    <Panel icon={Activity} title="Nhật ký thao tác">
      <ul className="space-y-3 text-sm">
        <li className="text-slate-300">
          <span className="font-mono text-xs text-slate-500">22:20</span> Khánh đổi chế độ MANUAL.
        </li>
        <li className="text-slate-300">
          <span className="font-mono text-xs text-slate-500">21:58</span> Hoàng xác nhận trạng thái Gateway.
        </li>
        <li className="text-slate-300">
          <span className="font-mono text-xs text-slate-500">20:05</span> Linh đăng nhập hệ thống.
        </li>
      </ul>
    </Panel>
  )
}

function Panel({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-5 text-violet-300" />
        <h2 className="font-bold text-slate-100">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
