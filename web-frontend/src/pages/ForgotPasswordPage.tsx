import { CheckCircle2, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthFrame } from '../components/auth/AuthFrame'
import { API_BASE_URL } from '../lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [submitted, setSubmitted] = useState(false)

  const submitRequest = async () => {
    if (!email.trim()) {
      setError('Vui lòng nhập email.')
      return
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Email không hợp lệ.')
      return
    }

    setError(undefined)
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitted(true)
      } else {
        setError(data.error || 'Có lỗi xảy ra, vui lòng thử lại!')
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
            <h1 className="mt-5 text-2xl font-bold">Yêu cầu đã được gửi</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Yêu cầu khôi phục mật khẩu cho tài khoản <span className="font-medium text-slate-200">{email}</span> đã được chuyển đến bộ phận Quản trị.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Hệ thống sẽ tự động gửi email chứa liên kết đặt lại mật khẩu cho bạn <span className="font-semibold text-emerald-300">ngay sau khi Admin phê duyệt</span>.
            </p>
            <Link
              className="mt-7 inline-flex w-full justify-center rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
              to="/login"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        </AuthFrame>
      )
    }

  return (
    <AuthFrame>
      <div className="mx-auto w-full max-w-sm">
        <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 font-bold text-cyan-300 md:hidden">
          CM
        </div>
        <h1 className="mt-5 text-2xl font-bold">Khôi phục mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Nhập email bạn đã đăng ký để nhận liên kết đặt lại mật khẩu.
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
              Email
              <div className="relative mt-2">
                <input
                  aria-invalid={Boolean(error)}
                  className={inputClassName(Boolean(error)) + ' pl-10'}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError(undefined)
                  }}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                />
                <Mail aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-500" />
              </div>
            </label>
            {error ? <p className="mt-1 text-xs text-rose-300">{error}</p> : null}
          </div>

          <button
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            type="submit"
          >
            Gửi yêu cầu
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Nhớ mật khẩu rồi?{' '}
          <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/login">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}

function inputClassName(hasError?: boolean) {
  return [
    'w-full rounded-lg border bg-[#050d1a] px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400',
    hasError ? 'border-rose-400/80' : 'border-slate-700',
  ].join(' ')
}
