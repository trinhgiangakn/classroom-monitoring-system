import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AlertsPage } from './AlertsPage'
import { deleteAlert, dismissResolvedAlerts, getAlerts, getAlertSummary } from '../services/alertApi'

vi.mock('../services/socket', () => ({
  ALERT_REALTIME_EVENTS: ['alert:new'],
  subscribeToRealtime: () => () => {},
}))

vi.mock('../services/alertApi', () => ({
  acknowledgeAlert: vi.fn(),
  deleteAlert: vi.fn(),
  dismissResolvedAlerts: vi.fn().mockResolvedValue({ room_id: 'P.101', dismissed: 3 }),
  resolveAlert: vi.fn(),
  restoreDismissedAlert: vi.fn(),
  getAlertSummary: vi.fn().mockResolvedValue({ critical: 0, warning: 1, resolved: 0, unresolved: 1, total: 1 }),
  getAlerts: vi.fn().mockResolvedValue([{
    id: '42',
    room_id: 'P.101',
    severity: 'WARNING',
    source: 'NODE-NE',
    message: 'NODE-NE có BLE RSSI -81 dBm.',
    status: 'NEW',
    metadata: null,
    created_at: '2026-08-17T03:00:00.000Z',
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
  }]),
}))

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear()
    window.localStorage.setItem('role', 'admin')
  }
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('AlertsPage', () => {
  it('loads API alerts and opens the selected alert in a detail dialog', async () => {
    const user = userEvent.setup()
    render(<AlertsPage />)

    await user.click(await screen.findByRole('button', { name: 'Chi tiết' }))

    const dialog = screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/NODE-NE có BLE RSSI -81 dBm/i)
    expect(dialog).toHaveTextContent('10:00:00 17/8/26')
    expect(screen.getByRole('button', { name: 'Xác nhận / Đã đọc' })).toBeInTheDocument()
  })

  it('shows confirmed global deletion only to an admin for a resolved alert', async () => {
    const tokenPayload = btoa(JSON.stringify({ role: 'admin' }))
    localStorage.setItem('accessToken', `header.${tokenPayload}.signature`)
    vi.mocked(getAlerts).mockResolvedValueOnce([{
      id: '84',
      room_id: 'P.101',
      severity: 'WARNING',
      source: 'NODE-NW',
      message: 'Cảnh báo đã xử lý',
      status: 'RESOLVED',
      metadata: null,
      created_at: '2026-08-17T03:00:00.000Z',
      acknowledged_by: null,
      acknowledged_at: null,
      resolved_by: 1,
      resolved_at: '2026-08-17T03:05:00.000Z',
    }])
    const user = userEvent.setup()
    render(<AlertsPage />)

    await user.click(await screen.findByRole('button', { name: 'Chi tiết' }))
    await user.click(screen.getByRole('button', { name: 'Xóa khỏi hệ thống' }))
    expect(deleteAlert).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Xác nhận xóa' }))
    expect(deleteAlert).toHaveBeenCalledWith('84')
  })

  it('hides all resolved alerts for the current user after one confirmation', async () => {
    vi.mocked(getAlertSummary).mockResolvedValueOnce({
      critical: 0, warning: 3, resolved: 3, unresolved: 0, total: 3,
    })
    const user = userEvent.setup()
    render(<AlertsPage />)

    await user.click(await screen.findByRole('button', { name: 'Ẩn tất cả đã xử lý' }))
    expect(dismissResolvedAlerts).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Xác nhận ẩn tất cả' }))

    expect(dismissResolvedAlerts).toHaveBeenCalledOnce()
  })

  it('does not show the information severity option', async () => {
    render(<AlertsPage />)

    expect(await screen.findByText('1 kết quả')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thông tin' })).not.toBeInTheDocument()
  })
})
