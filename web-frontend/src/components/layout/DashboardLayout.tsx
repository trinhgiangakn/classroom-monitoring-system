import { Outlet } from 'react-router-dom'
import { AppShell } from './AppShell'

interface DashboardLayoutProps {
  onLogout: () => void
}

export function DashboardLayout({ onLogout }: DashboardLayoutProps) {
  return (
    <AppShell onLogout={onLogout}>
      <Outlet />
    </AppShell>
  )
}
