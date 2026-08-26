import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { clearSession, getUserRole, hasValidSession } from './lib/api'
import { heartbeatApi, logoutApi } from './services/adminApi'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { AdminPage } from './pages/AdminPage'
import { AlertsPage } from './pages/AlertsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DeviceControlPage } from './pages/DeviceControlPage'
import { LoginPage } from './pages/LoginPage'
import { MonitoringPage } from './pages/MonitoringPage'
import { RegistrationPage } from './pages/RegistrationPage'
import { SystemStatusPage } from './pages/SystemStatusPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

function ProtectedRoute({ allowedRoles, children }: { allowedRoles: ('admin' | 'technician' | 'user')[]; children: React.ReactElement }) {
  const role = getUserRole()
  if (!allowedRoles.includes(role)) {
    return <Navigate replace to="/dashboard" />
  }
  return children
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasValidSession)

  // Send activity heartbeat ping every 45s while user is logged in
  useEffect(() => {
    if (!isAuthenticated) return

    // Immediate ping on mount
    void heartbeatApi()

    const interval = setInterval(() => {
      void heartbeatApi()
    }, 45_000)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  const logout = async () => {
    await logoutApi()
    clearSession()
    setIsAuthenticated(false)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            isAuthenticated ? (
              <Navigate replace to="/dashboard" />
            ) : (
              <LoginPage onDemoLogin={() => setIsAuthenticated(true)} />
            )
          }
          path="/login"
        />
        <Route element={<RegistrationPage />} path="/register" />
        <Route element={<ForgotPasswordPage />} path="/forgot-password" />
        <Route element={<ResetPasswordPage />} path="/reset-password" />
        <Route
          element={
            isAuthenticated ? (
              <DashboardLayout onLogout={logout} />
            ) : (
              <Navigate replace to="/login" />
            )
          }
        >
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<MonitoringPage />} path="/monitoring" />
          <Route element={<DeviceControlPage />} path="/devices" />
          <Route element={<AlertsPage />} path="/alerts" />
          <Route element={<ProtectedRoute allowedRoles={['admin', 'technician']}><SystemStatusPage /></ProtectedRoute>} path="/system-status" />
          <Route element={<ProtectedRoute allowedRoles={['admin', 'technician']}><AdminPage /></ProtectedRoute>} path="/admin" />
        </Route>
        <Route element={<Navigate replace to={isAuthenticated ? '/dashboard' : '/login'} />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

export default App
