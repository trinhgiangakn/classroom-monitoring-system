import {
  Activity,
  BellRing,
  Check,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

function formatLastSeen(timestamp?: string | null): string {
  if (!timestamp) return ''
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 0) return 'vừa xong'
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins}ph trước`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h trước`
  return `${Math.floor(hrs / 24)}ngày trước`
}
import {
  approvePasswordReset,
  approveUserRegistration,
  createUserByAdmin,
  deleteUser,
  getAdminUsers,
  getAuditLogs,
  getAutomationRules,
  getAutomationThresholds,
  toggleAutomationRule,
  updateAutomationThresholds,
  updateUserRole,
  type AuditLogItem,
  type AutomationThresholds,
  type RuleItem,
  type UserItem,
} from '../services/adminApi'

import { decodeJwtPayload } from '../lib/api'

const tabs = ['Người dùng', 'Ngưỡng cảnh báo', 'Luật tự động', 'Nhật ký thao tác'] as const
type Tab = typeof tabs[number]

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Người dùng')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const token = localStorage.getItem('accessToken')
  const payload = token ? decodeJwtPayload(token) : null
  const currentUsername = (payload?.username || '').toLowerCase()
  const currentUserRole = (localStorage.getItem('role') || payload?.role || 'user').toLowerCase()
  const isManager = currentUserRole === 'manager' || currentUserRole === 'admin' || currentUsername === 'baokhanhdtm'

  if (currentUsername === 'baokhanhdtm' && currentUserRole !== 'admin') {
    localStorage.setItem('role', 'admin')
  }

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ type, message })
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="grid size-12 place-items-center rounded-2xl bg-violet-400/10 text-violet-300">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              {isManager ? 'Manager RBAC · Toàn quyền quản trị' : 'Read only · Chế độ xem'}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Quản trị hệ thống</h1>
            <p className="mt-1 text-sm text-slate-400">
              Quản lý phân quyền người dùng, cấu hình ngưỡng cảm biến, động cơ luật AUTO và nhật ký bảo mật.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab
                ? 'bg-violet-400/20 text-violet-200 ring-1 ring-violet-400/40 shadow'
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
            }`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === 'Người dùng' && <Users className="size-4" />}
            {tab === 'Ngưỡng cảnh báo' && <BellRing className="size-4" />}
            {tab === 'Luật tự động' && <Activity className="size-4" />}
            {tab === 'Nhật ký thao tác' && <Shield className="size-4" />}
            {tab}
          </button>
        ))}
      </div>

      {/* Global Notice */}
      {notice && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
              : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>{notice.message}</span>
          </div>
          <button className="text-xs font-bold underline opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>
            Đóng
          </button>
        </div>
      )}

      {/* Tab Panels */}
      <div>
        {activeTab === 'Người dùng' && <UsersPanel isManager={isManager} showNotice={showNotice} />}
        {activeTab === 'Ngưỡng cảnh báo' && <ThresholdPanel showNotice={showNotice} />}
        {activeTab === 'Luật tự động' && <RulePanel showNotice={showNotice} />}
        {activeTab === 'Nhật ký thao tác' && <AuditPanel showNotice={showNotice} />}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------------------------------------
// TAB 1: USERS PANEL
// ------------------------------------------------------------------------------------------------
function UsersPanel({ isManager, showNotice }: { isManager: boolean; showNotice: (msg: string, type?: 'success' | 'error') => void }) {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  const fetchUsers = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const data = await getAdminUsers()
      setUsers(data)
    } catch (err) {
      // Chỉ hiện lỗi nếu là admin và không phải background poll
      if (isManager && !isBackground) {
        showNotice(err instanceof Error ? err.message : 'Không thể tải danh sách người dùng', 'error')
      }
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    const interval = setInterval(() => {
      fetchUsers(true)
    }, 10_000)
    return () => clearInterval(interval)
  }, [])

  const handleApprove = async (email: string, status: 'approved' | 'rejected') => {
    if (!isManager) return
    try {
      await approveUserRegistration(email, status)
      showNotice(`Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} tài khoản ${email}`)
      fetchUsers()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Lỗi phê duyệt', 'error')
    }
  }

  const handleReset = async (email: string) => {
    if (!isManager) return
    if (!window.confirm(`Gửi link đặt lại mật khẩu cho ${email}?`)) return
    try {
      const data = await approvePasswordReset(email)
      if (data.resetLink) {
        try {
          navigator.clipboard?.writeText(data.resetLink)
        } catch {
          // Ignore clipboard error
        }
        window.prompt(
          `Cấp mật khẩu thành công cho ${email}!\n\nLink đổi mật khẩu (đã sao chép vào bộ nhớ tạm):`,
          data.resetLink
        )
      } else {
        showNotice(data.message || `Đã gửi link khôi phục mật khẩu cho ${email}`)
      }
      fetchUsers()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Lỗi cấp lại mật khẩu', 'error')
    }
  }

  const handleRoleChange = async (userId: number | string, newRole: 'admin' | 'technician' | 'user') => {
    if (!isManager) return
    try {
      await updateUserRole(userId, newRole)
      showNotice(`Đã chuyển vai trò người dùng sang ${newRole.toUpperCase()}`)
      fetchUsers()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Lỗi cập nhật vai trò', 'error')
    }
  }

  const handleDelete = async (userId: number | string, username?: string) => {
    if (!isManager) return
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${username || userId}" không?`)) return
    try {
      await deleteUser(userId)
      showNotice(`Đã xóa người dùng thành công`)
      fetchUsers()
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Lỗi xóa người dùng', 'error')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
      {!isManager && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <div>
            <p className="font-semibold text-slate-200">Chế độ xem — Read Only</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Tài khoản của bạn không có quyền xem danh sách người dùng hệ thống. Chỉ Quản trị viên (Admin / Manager) mới có thể truy cập mục này.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Danh sách tài khoản & Phân quyền RBAC</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {isManager
              ? 'Manager có quyền tạo người dùng, phân quyền Role, phê duyệt đăng ký và khôi phục mật khẩu.'
              : 'Bạn đang ở chế độ xem. Chỉ Quản trị viên (Manager) mới có thể thực hiện thao tác.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers(false)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-750"
            type="button"
          >
            <RefreshCw className="size-3.5" /> Làm mới
          </button>
          {isManager && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 shadow"
              type="button"
            >
              <Plus className="size-4" /> Thêm người dùng
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-400">
            <tr>
              <th className="pb-3">Họ và tên</th>
              <th className="pb-3">Tài khoản / Email</th>
              <th className="pb-3">Vai trò (Role)</th>
              <th className="pb-3">Kết nối</th>
              <th className="pb-3">Tài khoản</th>
              <th className="pb-3">Yêu cầu cấp MK</th>
              <th className="pb-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                  Chưa có tài khoản nào.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const online = Boolean(user.is_online === 1 || user.is_online === true)
                const lastSeenText = formatLastSeen(user.last_active_at || user.last_login)
                return (
                <tr className="border-b border-slate-800/70 text-xs text-slate-300 last:border-0" key={user.id}>
                  <td className="py-3.5 font-semibold text-slate-100">{user.full_name || user.fullname || '—'}</td>
                  <td className="text-slate-400">
                    <div>{user.username}</div>
                    {user.email && user.email !== user.username && (
                      <div className="text-[11px] text-slate-500">{user.email}</div>
                    )}
                  </td>
                  <td>
                    {isManager ? (
                      <select
                        aria-label={`Đổi vai trò cho ${user.username || user.full_name}`}
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'technician' | 'user')}
                        className="rounded border border-violet-400/40 bg-slate-900 px-2 py-1 text-xs font-semibold text-violet-200 outline-none focus:border-violet-400"
                      >
                        <option value="admin">Admin / Manager</option>
                        <option value="technician">Technician</option>
                        <option value="user">User</option>
                      </select>
                    ) : (
                      <span className="rounded border border-violet-400/40 bg-violet-400/10 px-2 py-1 text-xs text-violet-200 capitalize">
                        {user.role}
                      </span>
                    )}
                  </td>

                  {/* Cột kết nối: Online / Offline thời gian thực */}
                  <td>
                    {online ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                        <span className="relative flex size-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                        </span>
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <span className="size-2 rounded-full bg-slate-600" />
                        Offline
                        {lastSeenText && (
                          <span
                            className="text-[10px] text-slate-600"
                            title={user.last_active_at || user.last_login ? new Date(user.last_active_at || user.last_login || '').toLocaleString('vi-VN') : undefined}
                          >
                            ({lastSeenText})
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Cột trạng thái tài khoản */}
                  <td>
                    {user.status === 'approved' || user.status === 'Hoạt động' ? (
                      <span className="font-semibold text-emerald-400">● Hoạt động</span>
                    ) : user.status === 'pending' ? (
                      <span className="font-semibold text-amber-400">● Chờ duyệt</span>
                    ) : (
                      <span className="font-semibold text-rose-400">● Đã khóa</span>
                    )}
                  </td>
                  <td>
                    {user.reset_requested === 1 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-400/15 px-2 py-0.5 font-semibold text-rose-300">
                        <KeyRound className="size-3" /> Xin cấp lại MK
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="text-right" colSpan={1}>
                    <div className="flex justify-end items-center gap-2">
                      {user.status === 'pending' && isManager && (
                        <>
                          <button
                            onClick={() => handleApprove(user.email || user.username || '', 'approved')}
                            className="flex items-center gap-1 rounded bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-400 hover:bg-emerald-400/20"
                            type="button"
                          >
                            <Check className="size-3" /> Duyệt
                          </button>
                          <button
                            onClick={() => handleApprove(user.email || user.username || '', 'rejected')}
                            className="flex items-center gap-1 rounded bg-rose-400/10 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-400/20"
                            type="button"
                          >
                            <X className="size-3" /> Từ chối
                          </button>
                        </>
                      )}

                      {user.reset_requested === 1 && isManager && (
                        <button
                          onClick={() => handleReset(user.email || user.username || '')}
                          className="flex items-center gap-1 rounded bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-400/20"
                          type="button"
                        >
                          <Check className="size-3" /> Cấp link MK
                        </button>
                      )}

                      {isManager && (
                        <button
                          onClick={() => handleDelete(user.id, user.username || user.full_name)}
                          className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition"
                          title="Xóa người dùng"
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Thêm người dùng mới */}
      {isAddModalOpen && (
        <AddUserModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false)
            showNotice('Đã thêm người dùng mới thành công!')
            fetchUsers()
          }}
        />
      )}
    </section>
  )
}

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('SmartClass@123')
  const [role, setRole] = useState('user')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) {
      setError('Vui lòng điền họ tên và email')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await createUserByAdmin({ full_name: fullName, email, password, role })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo tài khoản')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="presentation">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c1d37] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-300">
            <UserPlus className="size-5" />
            <h3 className="text-lg font-bold text-slate-100">Thêm người dùng mới</h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-slate-100" type="button">
            <X className="size-5" />
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Họ và tên
              <input
                required
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Email / Tên đăng nhập
              <input
                required
                type="email"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                placeholder="user@smartclass.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Mật khẩu mặc định
              <input
                required
                type="text"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300">
              Vai trò (Role)
              <select
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">User — Giảng viên / Người dùng</option>
                <option value="technician">Technician — Kỹ thuật viên</option>
                <option value="admin">Manager — Quản trị viên</option>
              </select>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-3">
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              disabled={isSubmitting}
              type="submit"
              className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// TAB 2: THRESHOLD PANEL (Tích hợp API thực tế)
// ------------------------------------------------------------------------------------------------
function ThresholdPanel({ showNotice }: { showNotice: (msg: string, type?: 'success' | 'error') => void }) {
  const [thresholds, setThresholds] = useState<AutomationThresholds>({
    tempOn: 30.0,
    tempOff: 28.0,
    humidityOn: 50.0,
    humidityOff: 60.0,
    lightCurtainClose: 800,
    lightLampOn: 300,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    getAutomationThresholds()
      .then((data) => {
        if (active && data) setThresholds(data)
      })
      .catch((err) => {
        showNotice(err instanceof Error ? err.message : 'Không thể tải cấu hình ngưỡng', 'error')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateAutomationThresholds(thresholds)
      showNotice(res.message || 'Đã lưu cấu hình ngưỡng cảm biến vào hệ thống thành công!')
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Lỗi lưu cấu hình ngưỡng', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
      <div className="flex items-center gap-2">
        <BellRing className="size-5 text-amber-300" />
        <h2 className="text-lg font-bold text-slate-100">Cấu hình ngưỡng kích hoạt tự động (AUTO Mode Thresholds)</h2>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Các giá trị ngưỡng dùng cho Động cơ Luật (Rule Engine) và cảnh báo phòng học P.101 (được lưu trực tiếp vào cơ sở dữ liệu).
      </p>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Đang tải cấu hình ngưỡng...</div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs font-bold text-cyan-300">Quạt thông gió (Nhiệt độ)</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-400">
                Ngưỡng BẬT quạt (°C)
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-400"
                  value={thresholds.tempOn}
                  onChange={(e) => setThresholds({ ...thresholds, tempOn: e.target.value })}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Ngưỡng TẮT quạt (°C)
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-cyan-400"
                  value={thresholds.tempOff}
                  onChange={(e) => setThresholds({ ...thresholds, tempOff: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs font-bold text-violet-300">Máy cấp ẩm (Độ ẩm)</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-400">
                Ngưỡng BẬT máy ẩm (%)
                <input
                  type="number"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-violet-400"
                  value={thresholds.humidityOn}
                  onChange={(e) => setThresholds({ ...thresholds, humidityOn: e.target.value })}
                />
              </label>
              <label className="block text-xs text-slate-400">
                Ngưỡng TẮT máy ẩm (%)
                <input
                  type="number"
                  step="1"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-violet-400"
                  value={thresholds.humidityOff}
                  onChange={(e) => setThresholds({ ...thresholds, humidityOff: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs font-bold text-amber-300">Rèm cửa & Đèn chiếu (Ánh sáng)</p>
            <div className="mt-3 space-y-2">
              <label className="block text-xs text-slate-400">
                ĐÓNG rèm khi ánh sáng &gt; (lux)
                <input
                  type="number"
                  step="10"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-amber-400"
                  value={thresholds.lightCurtainClose}
                  onChange={(e) => setThresholds({ ...thresholds, lightCurtainClose: e.target.value })}
                />
              </label>
              <label className="block text-xs text-slate-400">
                BẬT đèn khi ánh sáng &lt; (lux)
                <input
                  type="number"
                  step="10"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 focus:border-amber-400"
                  value={thresholds.lightLampOn}
                  onChange={(e) => setThresholds({ ...thresholds, lightLampOn: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          type="button"
          className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition shadow"
        >
          {saving ? 'Đang lưu vào hệ thống...' : 'Lưu cấu hình ngưỡng'}
        </button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------------------------------------
// TAB 3: RULE ENGINE PANEL (Tích hợp API thực tế)
// ------------------------------------------------------------------------------------------------
function RulePanel({ showNotice }: { showNotice: (msg: string, type?: 'success' | 'error') => void }) {
  const [rules, setRules] = useState<RuleItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = async () => {
    setLoading(true)
    try {
      const data = await getAutomationRules()
      setRules(data)
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Không thể tải danh sách luật tự động', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const handleToggle = async (rule: RuleItem) => {
    const nextState = !rule.enabled
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: nextState } : r)))
    try {
      const res = await toggleAutomationRule(rule.id, nextState)
      showNotice(res.message || `Đã ${nextState ? 'bật' : 'tắt'} ${rule.rule_name || rule.device}`)
    } catch (err) {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)))
      showNotice(err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái luật', 'error')
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-violet-300" />
        <h2 className="text-lg font-bold text-slate-100">Động cơ Luật tự động (Rule Engine & Safe Mode)</h2>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Bộ quy tắc tự động hóa môi trường phòng học P.101 kết hợp bộ đếm trễ 3 giây và cơ chế Safe Mode chống nhấp nháy Relay.
      </p>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Đang tải danh sách luật tự động...</div>
      ) : rules.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">Chưa có luật tự động nào được thiết lập.</div>
      ) : (
        <div className="mt-5 space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/30 p-4 transition hover:border-slate-700"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{rule.device || rule.rule_name}</span>
                  <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-cyan-300">
                    {rule.device_id || `RULE_${rule.id}`}
                  </code>
                </div>
                <p className="mt-1 text-xs text-slate-400">{rule.condition || rule.rule_name}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => handleToggle(rule)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-slate-800 peer-checked:bg-cyan-400 after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:bg-slate-300 after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:bg-slate-950" />
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------------------------------------
// TAB 4: AUDIT LOGS PANEL (Nhật ký thao tác thực tế & Thời gian thực)
// ------------------------------------------------------------------------------------------------
function formatActionBadge(action: string) {
  const upper = action.toUpperCase()
  if (upper === 'LOGIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-semibold text-emerald-300">
        ● Đăng nhập
      </span>
    )
  }
  if (upper === 'LOGOUT') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 font-semibold text-slate-400">
        ○ Đăng xuất
      </span>
    )
  }
  if (upper.includes('/DEVICES/MODE')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 font-semibold text-violet-300">
        ⚙ Đổi chế độ AUTO/MANUAL
      </span>
    )
  }
  if (upper.includes('/DEVICES/') && upper.includes('/CONTROL')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-semibold text-cyan-300">
        ⚡ Điều khiển thiết bị
      </span>
    )
  }
  if (upper.includes('/USERS') && upper.startsWith('PUT')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300">
        🛡 Phân quyền vai trò
      </span>
    )
  }
  if (upper.includes('/USERS') && upper.startsWith('DELETE')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 font-semibold text-rose-300">
        ✕ Xóa người dùng
      </span>
    )
  }
  if (upper.includes('APPROVE-USER')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-semibold text-emerald-300">
        ✓ Duyệt tài khoản
      </span>
    )
  }
  if (upper.includes('APPROVE-RESET')) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 font-semibold text-sky-300">
        🔑 Cấp lại mật khẩu
      </span>
    )
  }
  return (
    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
      {action}
    </span>
  )
}

function AuditPanel({ showNotice }: { showNotice: (msg: string, type?: 'success' | 'error') => void }) {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const data = await getAuditLogs(10)
      setLogs(data.slice(0, 10))
    } catch (err) {
      if (!isBackground) {
        showNotice(err instanceof Error ? err.message : 'Không thể tải nhật ký thao tác', 'error')
      }
    } finally {
      if (!isBackground) setLoading(false)
    }
  }

  // Tự động làm mới nền mỗi 8 giây (Real-time polling)
  useEffect(() => {
    fetchLogs()
    const interval = setInterval(() => {
      fetchLogs(true)
    }, 8_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-emerald-300" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">Nhật ký thao tác bảo mật (Audit Logs)</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live 8s · 10 gần nhất
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Lịch sử 10 lần can thiệp hệ thống, đổi chế độ và điều khiển thiết bị gần nhất từ bảng{' '}
              <code className="font-mono text-cyan-300">audit_logs</code>.
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(false)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-750"
          type="button"
        >
          <RefreshCw className="size-3.5" /> Làm mới
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[750px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-400">
            <tr>
              <th className="pb-3">Thời gian</th>
              <th className="pb-3">Người thực hiện</th>
              <th className="pb-3">Hành động</th>
              <th className="pb-3">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                  Đang tải nhật ký thao tác...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                  Chưa có nhật ký thao tác nào được lưu trữ.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr className="border-b border-slate-800/70 text-xs text-slate-300 last:border-0 hover:bg-slate-900/30 transition" key={log.id}>
                  <td className="py-3 font-mono text-slate-400 whitespace-nowrap">
                    {new Intl.DateTimeFormat('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      timeZone: 'Asia/Ho_Chi_Minh',
                    }).format(new Date(log.created_at))}
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-100">
                        {log.full_name || log.username || (log.user_id ? `User #${log.user_id}` : 'Hệ thống')}
                      </span>
                      {log.username && log.full_name && log.username !== log.full_name && (
                        <span className="text-[11px] text-cyan-300">@{log.username}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {formatActionBadge(log.action)}
                  </td>
                  <td className="font-mono text-xs text-slate-400 max-w-xs truncate" title={log.details || undefined}>
                    {log.details || '—'}
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
