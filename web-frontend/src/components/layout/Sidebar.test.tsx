import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'

vi.mock('../../services/alertApi', () => ({
  getAlertSummary: vi.fn().mockResolvedValue({ unresolved: 0 }),
}))

vi.mock('../../services/socket', () => ({
  ALERT_REALTIME_EVENTS: ['alert:new'],
  subscribeToConnection: (listener: (state: string) => void) => {
    listener('connected')
    return () => {}
  },
  subscribeToRealtime: () => () => {},
}))

vi.mock('../../services/dev2Api', () => ({
  getSystemHealth: vi.fn().mockResolvedValue({
    mqtt_connected: false,
    services: {
      database: { connected: true },
      mqtt: { connected: false },
    },
  }),
  getGatewayStatus: vi.fn().mockResolvedValue({ status: 'Online' }),
}))

afterEach(cleanup)

describe('Sidebar service indicators', () => {
  it('renders real health and gateway results instead of fixed green dots', async () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)

    expect(await screen.findByTitle('Offline')).toBeInTheDocument()
    expect(screen.getAllByTitle('Online')).toHaveLength(2)
  })
})
