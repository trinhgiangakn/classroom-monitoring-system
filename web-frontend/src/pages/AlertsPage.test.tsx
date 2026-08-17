import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AlertsPage } from './AlertsPage'

describe('AlertsPage', () => {
  it('opens the selected alert in a detail dialog', async () => {
    const user = userEvent.setup()
    render(<AlertsPage />)

    await user.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0])

    const dialog = screen.getByRole('dialog', { name: 'Chi tiết cảnh báo' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/NODE-NE có BLE RSSI -81 dBm/i)
  })
})
