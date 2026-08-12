import { CheckCircle2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AuthFrame } from '../components/auth/AuthFrame'
import { API_BASE_URL } from '../lib/api'

type RequestedRole = 'user' | 'technician'

interface RegistrationValues {
  fullName: string
  email: string
  password: string
  confirmPassword: string
  requestedRole: RequestedRole
}

type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>

const initialValues: RegistrationValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  requestedRole: 'user',
}

function validate(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {}

  if (!values.fullName.trim()) {
    errors.fullName = 'Họ và tên là bắt buộc.'
  }

  if (!values.email.trim()) {
    errors.email = 'Email là bắt buộc.'
  } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
    errors.email = 'Email không hợp lệ.'
  }

  if (!values.password) {
    errors.password = 'Mật khẩu là bắt buộc.'
  } else if (values.password.length < 8) {
    errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.'
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu là bắt buộc.'
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Xác nhận mật khẩu không khớp.'
  }

  return errors
}

export function RegistrationPage() {
  const [values, setValues] = useState<RegistrationValues>(initialValues)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const updateValue = <Field extends keyof RegistrationValues>(
    field: Field,
    value: RegistrationValues[Field],
  ) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const submitRequest = async () => {
    const nextErrors = validate(values)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length === 0) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: values.fullName, 
            email: values.email,
            password: values.password,
            role: values.requestedRole  
          })
        })

        const data = await response.json()

        if (response.ok) {
          setSubmitted(true)
        } else {
          setErrors({ email: data.error || data.message || 'Đăng ký thất bại từ máy chủ!' })
        }
      } catch (error) {
        console.error('Lỗi đăng ký tài khoản:', error)
        alert(`Không thể kết nối đến máy chủ Backend (${API_BASE_URL})!`)
      }
    }
  }

  if (submitted) {
    return (
      <AuthFrame>
        <div className="mx-auto w-full max-w-sm text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-12 text-emerald-300" />
          <h1 className="mt-5 text-2xl font-bold">Yêu cầu đã được gửi</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Tài khoản <span className="font-medium text-slate-200">{values.email}</span> đang chờ Admin phê duyệt.
          </p>
          <Link
            className="mt-7 inline-flex rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
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
        <h1 className="mt-5 text-2xl font-bold">Đăng ký tài khoản</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Gửi yêu cầu tạo tài khoản. Admin sẽ phê duyệt trước khi bạn có thể đăng nhập.
        </p>

        <form
          className="mt-7 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            submitRequest()
          }}
        >
          <FieldError message={errors.fullName}>
            <label className="block text-sm font-medium text-slate-300">
              Họ và tên
              <input
                aria-invalid={Boolean(errors.fullName)}
                className={inputClassName(errors.fullName)}
                name="fullName"
                onChange={(event) => updateValue('fullName', event.target.value)}
                placeholder="Ví dụ: Nguyễn Quang Khánh"
                value={values.fullName}
              />
            </label>
          </FieldError>

          <FieldError message={errors.email}>
            <label className="block text-sm font-medium text-slate-300">
              Email
              <input
                aria-invalid={Boolean(errors.email)}
                className={inputClassName(errors.email)}
                name="email"
                onChange={(event) => updateValue('email', event.target.value)}
                placeholder="name@example.com"
                type="email"
                value={values.email}
              />
            </label>
          </FieldError>

          <FieldError message={errors.password}>
            <label className="block text-sm font-medium text-slate-300">
              Mật khẩu
              <input
                aria-invalid={Boolean(errors.password)}
                className={inputClassName(errors.password)}
                name="password"
                onChange={(event) => updateValue('password', event.target.value)}
                type="password"
                value={values.password}
              />
            </label>
          </FieldError>

          <FieldError message={errors.confirmPassword}>
            <label className="block text-sm font-medium text-slate-300">
              Xác nhận mật khẩu
              <input
                aria-invalid={Boolean(errors.confirmPassword)}
                className={inputClassName(errors.confirmPassword)}
                name="confirmPassword"
                onChange={(event) => updateValue('confirmPassword', event.target.value)}
                type="password"
                value={values.confirmPassword}
              />
            </label>
          </FieldError>

          <label className="block text-sm font-medium text-slate-300">
            Vai trò yêu cầu
            <select
              className="mt-2 w-full rounded-lg border border-slate-700 bg-[#050d1a] px-3 py-2.5 text-sm outline-none focus:border-cyan-400"
              name="requestedRole"
              onChange={(event) => updateValue('requestedRole', event.target.value as RequestedRole)}
              value={values.requestedRole}
            >
              <option value="user">User — xem dữ liệu và điều khiển khi MANUAL</option>
              <option value="technician">Technician — xem trạng thái kỹ thuật</option>
            </select>
          </label>
          <p className="-mt-2 text-xs leading-5 text-slate-500">
            Manager không thể tự đăng ký; vai trò này do hệ thống quản trị cấp.
          </p>

          <button
            className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            type="submit"
          >
            Gửi yêu cầu đăng ký
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Đã có tài khoản?{' '}
          <Link className="font-semibold text-cyan-300 hover:text-cyan-200" to="/login">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </AuthFrame>
  )
}

function FieldError({ children, message }: { children: ReactNode; message?: string }) {
  return (
    <div>
      {children}
      {message ? <p className="mt-1 text-xs text-rose-300">{message}</p> : null}
    </div>
  )
}

function inputClassName(hasError?: string) {
  return [
    'mt-2 w-full rounded-lg border bg-[#050d1a] px-3 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-400',
    hasError ? 'border-rose-400/80' : 'border-slate-700',
  ].join(' ')
}
