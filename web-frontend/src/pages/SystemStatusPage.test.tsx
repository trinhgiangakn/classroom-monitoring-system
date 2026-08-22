import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SystemStatusPage } from './SystemStatusPage'

vi.mock('../services/socket', () => ({
  SYSTEM_REALTIME_EVENTS: ['gateway:status'],
  subscribeToConnection: () => () => {},
  subscribeToRealtime: () => () => {},
}))

vi.mock('../services/dev2Api', () => ({
  getNodes: vi.fn().mockResolvedValue([]),
  getLatestSensors: vi.fn().mockResolvedValue([]),
  getGatewayStatus: vi.fn().mockResolvedValue({
    gateway_id: 'GW-P101-01',
    status: 'Online',
    wifi_connected: true,
    mqtt_connected: true,
    wifi_signal_dbm: -51,
    ip_address: '192.168.1.20',
    firmware_version: '1.0.0',
    last_seen: 'vừa xong',
    metrics: {
      cpu_usage_percent: 12,
      ram_heap_percent: 28,
      mqtt_queue_percent: 0,
      uptime_seconds: 600,
      timestamp: '2026-08-17T08:00:00Z',
    },
  }),
  getSystemHealth: vi.fn().mockRejectedValue(new Error('connection refused')),
}))

afterEach(cleanup)

describe('SystemStatusPage', () => {
  it('keeps successful gateway data and reports backend-dependent services as unknown', async () => {
    render(<SystemStatusPage />)

    const gatewayCard = (await screen.findByText('ESP32 Gateway')).closest('article')
    const backendCard = screen.getByText('Node.js Backend').closest('article')
    const databaseCard = screen.getByText('MySQL Database').closest('article')

    expect(gatewayCard).not.toBeNull()
    expect(backendCard).not.toBeNull()
    expect(databaseCard).not.toBeNull()
    expect(within(gatewayCard!).getByText('● Online')).toBeInTheDocument()
    expect(within(backendCard!).getByText('● Offline')).toBeInTheDocument()
    expect(within(databaseCard!).getByText('● Không xác định')).toBeInTheDocument()
    expect(screen.getByText(/Backend không phản hồi/)).toBeInTheDocument()
    expect(screen.getByText('Tự kiểm tra mỗi 15 giây')).toBeInTheDocument()
  })
})
