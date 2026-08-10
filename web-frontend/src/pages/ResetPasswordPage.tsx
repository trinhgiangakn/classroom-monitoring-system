import { LockKeyhole, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AuthFrame } from '../components/auth/AuthFrame'
import { API_BASE_URL } from '../lib/api'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [submitted, setSubmitted] = useState(false)

  const submitRequest = async () => {
    if (!password) {
      setError('Vui lòng nhập mật khẩu mới.')
      return
    } else if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    } else if (password !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    if (!email || !token) {
      setError('Link không hợp lệ hoặc thiếu thông tin.')
      return
    }

    setError(undefined)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPassword: password })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Có lỗi xảy ra!')
      }
    } catch (err) {
      console.error(err)
      setError('Không thể kết nối đến máy chủ!')
    }
  }

  if (submitted) {
    return (
      <AuthFrame>
        <div className="mx-auto w-full max-w-sm text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-emerald-300" />
          <h1 className="mt-5 text-2xl font-bold">Thành công!</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Mật khẩu của bạn đã được đặt lại thành công.
          </p>
          <Link
            className="mt-7 inline-flex w-full justify-center rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            to="/login"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame>
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mt-5 text-2xl font-bold">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Tài khoản: <span className="font-medium text-slate-200">{email}</span>
        </p>

        <form
          className="mt-7 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submitRequest()
          }}
        >
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Mật khẩu mới
              <div className="relative mt-2">
                <input
                  className={inputClassName(Boolean(error))}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(undefined)
                  }}
                  type="password"
                  value={password}
                />
                <LockKeyhole aria-hidden="true" className="absolute right-3 top-3 size-4 text-slate-500" />
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Xác nhận mật khẩu
              <div className="relative mt-2">
                <input
                  className={inputClassName(Boolean(error))}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setError(undefined)
                  }}
                  type="password"
                  value={confirmPassword}
                />
                <LockKeyhole aria-hidden="true" className="absolute right-3 top-3 size-4 text-slate-500" />
              </div>
            </label>
          </div>

          {error && <p className="text-xs text-rose-300">{error}</p>}

          <button
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            type="submit"
          >
            Lưu mật khẩu mới
          </button>
        </form>
      </div>
    </AuthFrame>
  )
}

function inputClassName(hasError?: boolean) {
  return [
    'w-full rounded-lg border bg-[#050d1a] px-3 py-2.5 pr-10 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400',
    hasError ? 'border-rose-400/80' : 'border-slate-700',
  ].join(' ')
}
