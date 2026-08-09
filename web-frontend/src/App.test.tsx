import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  localStorage.clear()
  window.history.pushState({}, '', '/login')
  const payload = btoa(JSON.stringify({ username: 'demo', role: 'user', exp: Math.floor(Date.now() / 1000) + 3600 }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token: `header.${payload}.signature`, role: 'user' }),
  }))
})

async function signIn() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Tên đăng nhập hoặc email'), 'demo@example.com')
  await user.type(screen.getByLabelText('Mật khẩu'), 'smartclass123')
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  return user
}

describe('Smart Classroom authenticated navigation', () => {
  it('shows the login screen before a user signs in', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Đăng nhập hệ thống' }),
    ).toBeInTheDocument()
  })

  it('shows the P.101 dashboard after API sign-in', async () => {
    render(<App />)

    await signIn()

    expect(
      await screen.findByRole('heading', { name: 'Tổng quan phòng P.101' }),
    ).toBeInTheDocument()
  })

  it('opens registration from the login screen', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('link', { name: 'Đăng ký tài khoản' }))

    expect(
      await screen.findByRole('heading', { name: 'Đăng ký tài khoản' }),
    ).toBeInTheDocument()
  })

  it('keeps a user on login when required credentials are blank', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByLabelText('Tên đăng nhập hoặc email'))
    await user.clear(screen.getByLabelText('Mật khẩu'))
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(screen.getByText('Vui lòng nhập email hoặc tên đăng nhập.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeInTheDocument()
  })

  it('opens the monitoring route from the dashboard sidebar', async () => {
    render(<App />)

    const user = await signIn()
    await user.click(await screen.findByRole('link', { name: 'Giám sát dữ liệu' }))

    expect(window.location.pathname).toBe('/monitoring')
    expect(
      await screen.findByRole('heading', { name: 'Giám sát dữ liệu môi trường' }),
    ).toBeInTheDocument()
  })
})
