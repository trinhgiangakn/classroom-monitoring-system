import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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
              <DashboardLayout onLogout={() => setIsAuthenticated(false)} />
            ) : (
              <Navigate replace to="/login" />
            )
          }
        >
          <Route element={<DashboardPage />} path="/dashboard" />
          <Route element={<MonitoringPage />} path="/monitoring" />
          <Route element={<DeviceControlPage />} path="/devices" />
          <Route element={<AlertsPage />} path="/alerts" />
          <Route element={<SystemStatusPage />} path="/system-status" />
          <Route element={<AdminPage />} path="/admin" />
        </Route>
        <Route element={<Navigate replace to={isAuthenticated ? '/dashboard' : '/login'} />} path="*" />
      </Routes>
    </BrowserRouter>
  )
}

export default App
