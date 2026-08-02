import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
  onLogout: () => void
}

export function AppShell({ children, onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#050d1a] text-slate-100 lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header onLogout={onLogout} />
        <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
