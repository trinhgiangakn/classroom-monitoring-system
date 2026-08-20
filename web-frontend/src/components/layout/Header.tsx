import { CircleUserRound, LogOut } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { decodeJwtPayload } from '../../lib/api'

interface HeaderProps {
  onLogout: () => void
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/monitoring': 'Giám sát dữ liệu',
  '/devices': 'Điều khiển thiết bị',
  '/alerts': 'Cảnh báo',
  '/system-status': 'Trạng thái hệ thống',
  '/admin': 'Quản trị',
}

export function Header({ onLogout }: HeaderProps) {
  const { pathname } = useLocation()
  const pageTitle = pageTitles[pathname] ?? pageTitles['/dashboard']

  const [user, setUser] = useState({ name: 'Loading...', role: '...' })
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      const decoded = decodeJwtPayload(token)
      if (decoded) {
        setUser({
          name: decoded.username || 'User',
          role: decoded.role ? decoded.role.toUpperCase() : 'USER'
        })
      }
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#06152a] px-4 py-3 sm:px-6">
      <div>
        <p className="text-xs text-slate-400">Phòng học <span className="px-1">›</span> {pageTitle}</p>
        <p className="mt-1 text-sm font-semibold text-slate-100">Phòng P.101</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden font-mono text-xs text-slate-500 sm:inline">{time.toLocaleTimeString()}</span>
        <button
          className="group flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-2 text-sm text-slate-200 hover:border-cyan-400/60 hover:text-cyan-200"
          onClick={onLogout}
          title="Đăng xuất demo"
          type="button"
        >
          <CircleUserRound aria-hidden="true" className="size-4 text-cyan-300" />
          <span className="hidden sm:inline">{user.name} · {user.role}</span>
          <LogOut aria-label="Đăng xuất" className="size-3.5 opacity-70 group-hover:opacity-100" />
        </button>
      </div>
    </header>
  )
}
