import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RegistrationPage } from './RegistrationPage'

afterEach(cleanup)

function renderRegistrationPage() {
  return render(
    <MemoryRouter>
      <RegistrationPage />
    </MemoryRouter>,
  )
}

describe('RegistrationPage', () => {
  it('shows field errors when a blank registration request is submitted', async () => {
    const user = userEvent.setup()
    renderRegistrationPage()

    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu đăng ký' }))

    expect(screen.getByText('Họ và tên là bắt buộc.')).toBeInTheDocument()
    expect(screen.getByText('Email là bắt buộc.')).toBeInTheDocument()
    expect(screen.getByText('Mật khẩu là bắt buộc.')).toBeInTheDocument()
    expect(screen.getByText('Xác nhận mật khẩu là bắt buộc.')).toBeInTheDocument()
  })

  it('shows an approval-pending message after a valid registration request', async () => {
    const user = userEvent.setup()
    renderRegistrationPage()

    await user.type(screen.getByRole('textbox', { name: 'Họ và tên' }), 'Nguyễn Quang Khánh')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'khanh@example.com')
    await user.type(screen.getByLabelText('Mật khẩu'), 'smartclass123')
    await user.type(screen.getByLabelText('Xác nhận mật khẩu'), 'smartclass123')
    await user.selectOptions(screen.getByLabelText('Vai trò yêu cầu'), 'technician')
    await user.click(screen.getByRole('button', { name: 'Gửi yêu cầu đăng ký' }))

    expect(
      await screen.findByRole('heading', { name: 'Yêu cầu đã được gửi' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/đang chờ Manager phê duyệt/i)).toBeInTheDocument()
  })
})
