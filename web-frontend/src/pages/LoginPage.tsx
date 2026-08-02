import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthFrame } from '../components/auth/AuthFrame'

interface LoginPageProps {
  onDemoLogin: () => void
}

interface LoginErrors {
  identifier?: string
  password?: string
}

export function LoginPage({ onDemoLogin }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('khanh.manager@smartclass.vn')
  const [password, setPassword] = useState('demo12345')
  const [errors, setErrors] = useState<LoginErrors>({})

  const submitLogin = () => {
    const nextErrors: LoginErrors = {}

    if (!identifier.trim()) {
      nextErrors.identifier = 'Vui lòng nhập email hoặc tên đăng nhập.'
    } else if (identifier.includes('@') && !/^\S+@\S+\.\S+$/.test(identifier)) {
      nextErrors.identifier = 'Email không hợp lệ.'
    }

    if (!password) {
      nextErrors.password = 'Vui lòng nhập mật khẩu.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      onDemoLogin()
    }
  }

  return (
    <AuthFrame>
      <div className="mx-auto w-full max-w-sm">
        <div className="grid size-10 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 font-bold text-cyan-300 md:hidden">
          CM
        </div>
        <h1 className="mt-5 text-2xl font-bold">Đăng nhập hệ thống</h1>
        <p className="mt-2 text-sm text-slate-400">Sử dụng tài khoản được cấp để tiếp tục.</p>

        <form
          className="mt-7 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submitLogin()
          }}
        >
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Tên đăng nhập hoặc email
              <input
                aria-invalid={Boolean(errors.identifier)}
                className={inputClassName(errors.identifier)}
                onChange={(event) => {
                  setIdentifier(event.target.value)
                  setErrors((current) => ({ ...current, identifier: undefined }))
                }}
                type="text"
                value={identifier}
              />
            </label>
            {errors.identifier ? <p className="mt-1 text-xs text-rose-300">{errors.identifier}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Mật khẩu
              <div className="relative mt-2">
                <input
                  aria-invalid={Boolean(errors.password)}
                  className={inputClassName(errors.password) + ' pr-10'}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setErrors((current) => ({ ...current, password: undefined }))
                  }}
                  type="password"
                  value={password}
                />
                <LockKeyhole aria-hidden="true" className="absolute right-3 top-3 size-4 text-slate-500" />
              </div>
            </label>
            {errors.password ? <p className="mt-1 text-xs text-rose-300">{errors.password}</p> : null}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2">
              <input className="accent-cyan-400" type="checkbox" />
              Ghi nhớ đăng nhập
            </label>
            <span className="font-medium text-cyan-300">Quên mật khẩu?</span>
          </div>

          <button className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300" type="submit">
            Đăng nhập
          </button>
        </form>

        <p className="mt-5 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
          Chưa có tài khoản?{' '}
          <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/register">
            Đăng ký tài khoản
          </Link>
        </p>

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-xs leading-5 text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-300">
            <ShieldCheck aria-hidden="true" className="size-4 text-emerald-300" /> Phiên bản demo Frontend
          </div>
          <p className="mt-1">
            Chưa gọi Backend, chưa lưu mật khẩu và chưa kết nối MQTT trực tiếp từ trình duyệt.
          </p>
        </div>
      </div>
    </AuthFrame>
  )
}

function inputClassName(hasError?: string) {
  return [
    'mt-2 w-full rounded-lg border bg-[#050d1a] px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400',
    hasError ? 'border-rose-400/80' : 'border-slate-700',
  ].join(' ')
}
