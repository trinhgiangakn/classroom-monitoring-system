import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DeviceControlPage } from './DeviceControlPage'

describe('DeviceControlPage', () => {
  it('locks manual device controls when AUTO mode is selected', async () => {
    const user = userEvent.setup()
    render(<DeviceControlPage />)

    await user.click(screen.getByRole('button', { name: 'AUTO' }))

    expect(screen.getByText(/AUTO đang kích hoạt/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tắt Đèn chiếu/i })).toBeDisabled()
  })
})
