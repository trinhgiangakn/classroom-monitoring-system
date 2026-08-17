import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  HelpCircle,
  LampDesk,
  Loader2,
  Lock,
  RefreshCw,
  Sliders,
  VenetianMask,
  Wind,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  controlDevice,
  getDeviceCommands,
  getDevices,
  setOperationMode,
  type DeviceCommandLogDto,
  type DeviceDto,
} from '../services/deviceApi'

const deviceIcons: Record<string, typeof LampDesk> = {
  LIGHT_01: LampDesk,
  RELAY_1: LampDesk,
  FAN_01: Wind,
  RELAY_2: Wind,
  HUMIDIFIER_01: Droplets,
  RELAY_3: Droplets,
  CURTAIN_01: VenetianMask,
  CURTAIN_MOTOR: VenetianMask,
}

export function DeviceControlPage() {
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [devices, setDevices] = useState<DeviceDto[]>([])
  const [commands, setCommands] = useState<DeviceCommandLogDto[]>([])
  const [loading, setLoading] = useState(true)
  const [isChangingMode, setIsChangingMode] = useState(false)
  const [pendingDeviceAction, setPendingDeviceAction] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const isLocked = mode === 'AUTO'

  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true)
    try {
      const [deviceRes, commandRes] = await Promise.all([
        getDevices(),
        getDeviceCommands(10),
      ])
      setMode(deviceRes.operation_mode)
      setDevices(deviceRes.devices)
      setCommands(commandRes)
    } catch (err) {
      if (isInitial) {
        setNotification({
          type: 'error',
          message: err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ Backend',
        })
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    loadData(true)

    // Auto-polling data every 3 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && active) {
        loadData(false)
      }
    }, 3000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const handleModeChange = async (targetMode: 'MANUAL' | 'AUTO') => {
    if (mode === targetMode || isChangingMode) return
    setIsChangingMode(true)
    try {
      const res = await setOperationMode(targetMode)
      setMode(targetMode)
      setNotification({ type: 'success', message: res.message })
      await loadData(false)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi chuyển chế độ',
      })
    } finally {
      setIsChangingMode(false)
    }
  }

  const handleToggleRelay = async (device: DeviceDto) => {
    if (isLocked) return
    const isCurrentlyOn = device.actual_state === 'ON'
    const nextAction = isCurrentlyOn ? 'TURN_OFF' : 'TURN_ON'

    setPendingDeviceAction(device.device_id)
    try {
      const res = await controlDevice(device.device_id, nextAction)
      setNotification({
        type: 'info',
        message: `Đã gửi lệnh ${nextAction === 'TURN_ON' ? 'BẬT' : 'TẮT'} ${device.name}. ${res.message}`,
      })
      // Optimistic update
      setDevices((prev) =>
        prev.map((d) =>
          d.device_id === device.device_id ? { ...d, actual_state: nextAction === 'TURN_ON' ? 'ON' : 'OFF' } : d
        )
      )
      // Reload commands history
      setTimeout(() => loadData(false), 800)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi gửi lệnh điều khiển',
      })
    } finally {
      setPendingDeviceAction(null)
    }
  }

  const handleCurtainAction = async (deviceId: string, action: 'OPEN' | 'STOP' | 'CLOSE') => {
    if (isLocked) return
    const actionName = action === 'OPEN' ? 'MỞ' : action === 'CLOSE' ? 'ĐÓNG' : 'DỪNG'

    setPendingDeviceAction(deviceId)
    try {
      const res = await controlDevice(deviceId, action)
      setNotification({
        type: 'info',
        message: `Đã gửi lệnh ${actionName} rèm cửa. ${res.message}`,
      })
      const nextState = action === 'OPEN' ? 'OPENING' : action === 'CLOSE' ? 'CLOSING' : 'STOPPED'
      setDevices((prev) =>
        prev.map((d) => (d.device_id === deviceId ? { ...d, actual_state: nextState } : d))
      )
      setTimeout(() => loadData(false), 800)
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Lỗi điều khiển rèm',
      })
    } finally {
      setPendingDeviceAction(null)
    }
  }

  const curtainDevice = devices.find((d) => d.type === 'MOTOR' || d.device_id.includes('CURTAIN'))
  const relayDevices = devices.filter((d) => d !== curtainDevice)

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Điều khiển thiết bị · {loading ? 'Đang tải...' : 'Live Hardware MQTT'}
            </p>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              MQTT QoS 1
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Điều khiển thiết bị</h1>
          <p className="mt-2 text-sm text-slate-400">
            Luồng lệnh: Web ➔ Backend ➔ MQTT Broker ➔ ESP32 Gateway ➔ Nhận phản hồi ACK.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-1.5 shadow-inner">
          <button
            aria-pressed={mode === 'MANUAL'}
            disabled={isChangingMode}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              mode === 'MANUAL'
                ? 'bg-cyan-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-100 disabled:opacity-50'
            }`}
            onClick={() => handleModeChange('MANUAL')}
            type="button"
          >
            <Sliders className="size-4" /> MANUAL
          </button>
          <button
            aria-pressed={mode === 'AUTO'}
            disabled={isChangingMode}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              mode === 'AUTO'
                ? 'bg-cyan-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-100 disabled:opacity-50'
            }`}
            onClick={() => handleModeChange('AUTO')}
            type="button"
          >
            <Lock className="size-4" /> AUTO
          </button>
        </div>
      </div>

      {/* Mode Notification Banner */}
      {isLocked ? (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          <Lock aria-hidden="true" className="size-5 shrink-0 text-cyan-300" />
          <div>
            <strong>Chế độ AUTO đang kích hoạt:</strong> Các thiết bị đang được điều khiển tự động bởi Động cơ Luật (Rule Engine) theo dữ liệu cảm biến. Nút bấm thủ công đã được khóa an toàn.
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-emerald-400" />
          <div>
            <strong>Chế độ MANUAL đang kích hoạt:</strong> Quản trị viên (Manager) có thể can thiệp bật/tắt thiết bị và đóng mở rèm cửa trực tiếp.
          </div>
        </div>
      )}

      {/* Action Notification Alert */}
      {notification ? (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
            notification.type === 'error'
              ? 'border-rose-400/40 bg-rose-400/10 text-rose-200'
              : notification.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
              : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            className="text-xs font-bold underline opacity-70 hover:opacity-100"
            onClick={() => setNotification(null)}
          >
            Đóng
          </button>
        </div>
      ) : null}

      {/* Grid Relay Devices (Đèn, Quạt, Máy cấp ẩm) */}
      <section className="grid gap-4 md:grid-cols-3">
        {relayDevices.map((device) => {
          const Icon = deviceIcons[device.device_id] || LampDesk
          const isOn = device.actual_state === 'ON'
          const isPending = pendingDeviceAction === device.device_id

          return (
            <article
              className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                isOn
                  ? 'border-cyan-400/40 bg-gradient-to-b from-[#0c1d37] to-[#0a254a] shadow-lg shadow-cyan-950/30'
                  : 'border-slate-800 bg-[#0c1d37]'
              }`}
              key={device.device_id}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className={`grid size-12 place-items-center rounded-xl ${
                      isOn ? 'bg-cyan-400/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-6" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      isOn
                        ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : 'border border-slate-700 bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    {isOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-bold text-slate-100">{device.name}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Mã thiết bị: <code className="font-mono text-cyan-300">{device.device_id}</code> · Loại: {device.type}
                </p>
              </div>

              <div className="mt-6">
                <button
                  aria-label={`${isOn ? 'Tắt' : 'Bật'} ${device.name}`}
                  aria-pressed={isOn}
                  disabled={isLocked || isPending}
                  onClick={() => handleToggleRelay(device)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isOn
                      ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20 hover:bg-cyan-300 active:scale-[0.98]'
                      : 'border border-slate-700 bg-slate-800/50 text-slate-200 hover:border-cyan-400 hover:text-cyan-300 active:scale-[0.98]'
                  }`}
                  type="button"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Đang chờ ESP32 ACK...
                    </>
                  ) : isOn ? (
                    'Đang bật — Nhấn để tắt'
                  ) : (
                    'Đang tắt — Nhấn để bật'
                  )}
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {/* Motor Device: Rèm cửa */}
      {curtainDevice && (
        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="grid size-12 place-items-center rounded-xl bg-amber-400/10 text-amber-300">
                <VenetianMask aria-hidden="true" className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">{curtainDevice.name}</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Mã thiết bị: <code className="font-mono text-amber-300">{curtainDevice.device_id}</code> · Trạng thái hiện tại:{' '}
                  <strong className="text-slate-200">
                    {curtainDevice.actual_state === 'OPENING'
                      ? 'Đang mở'
                      : curtainDevice.actual_state === 'CLOSING'
                      ? 'Đang đóng'
                      : 'Đang dừng'}
                  </strong>
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                    Limit Open: <span className="text-emerald-400">{curtainDevice.limit_open_status || 'OK'}</span>
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                    Limit Close: <span className="text-emerald-400">{curtainDevice.limit_close_status || 'OK'}</span>
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-400">
                    Timeout bảo vệ: <span className="text-cyan-300">{curtainDevice.timeout_seconds || 30}s</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Curtain Actions */}
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {(
                [
                  ['OPEN', 'Mở rèm'],
                  ['STOP', 'Dừng'],
                  ['CLOSE', 'Đóng rèm'],
                ] as const
              ).map(([action, label]) => {
                const isCurtainPending = pendingDeviceAction === curtainDevice.device_id
                return (
                  <button
                    className={`flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-bold text-slate-100 transition hover:border-amber-300 hover:text-amber-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-initial`}
                    disabled={isLocked || isCurtainPending}
                    key={action}
                    onClick={() => handleCurtainAction(curtainDevice.device_id, action)}
                    type="button"
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Lịch sử lệnh điều khiển & Quy trình xử lý lệnh (Command Execution History) */}
      <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0c1d37] p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-cyan-300" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Lịch sử lệnh điều khiển & Phản hồi ESP32 ACK</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Nhật ký 10 lệnh điều khiển gần nhất kèm thời gian phản hồi phần cứng từ bảng{' '}
                <code className="font-mono text-cyan-300">device_commands</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => loadData(false)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            type="button"
          >
            <RefreshCw className="size-3.5" /> Làm mới
          </button>
        </div>

        <table className="mt-4 w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-400">
            <tr>
              <th className="pb-3">Mã lệnh</th>
              <th className="pb-3">Thời gian</th>
              <th className="pb-3">Thiết bị</th>
              <th className="pb-3">Hành động</th>
              <th className="pb-3">Nguồn</th>
              <th className="pb-3">Người gửi</th>
              <th className="pb-3 text-right">Trạng thái phản hồi</th>
            </tr>
          </thead>
          <tbody>
            {commands.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                  Chưa có lệnh điều khiển nào được ghi nhận.
                </td>
              </tr>
            ) : (
              commands.map((cmd) => {
                const isSuccess = cmd.status === 'SUCCESS'
                const isPending = cmd.status === 'PENDING'
                const isTimeout = cmd.status === 'TIMEOUT'

                return (
                  <tr className="border-b border-slate-800/70 text-xs text-slate-300 last:border-0" key={cmd.command_id}>
                    <td className="py-3 font-mono text-cyan-300">{cmd.command_id.substring(0, 14)}...</td>
                    <td className="font-mono text-slate-400">
                      {cmd.requested_at
                        ? new Intl.DateTimeFormat('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                          }).format(new Date(cmd.requested_at))
                        : '—'}
                    </td>
                    <td className="font-semibold text-slate-100">{cmd.device_name || cmd.device_id}</td>
                    <td>
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-bold text-slate-200">
                        {cmd.action === 'TURN_ON'
                          ? 'BẬT'
                          : cmd.action === 'TURN_OFF'
                          ? 'TẮT'
                          : cmd.action === 'OPEN'
                          ? 'MỞ'
                          : cmd.action === 'CLOSE'
                          ? 'ĐÓNG'
                          : cmd.action === 'STOP'
                          ? 'DỪNG'
                          : cmd.action}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          cmd.source === 'AUTO'
                            ? 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                            : 'border border-slate-700 text-slate-400'
                        }`}
                      >
                        {cmd.source || 'MANUAL'}
                      </span>
                    </td>
                    <td className="text-slate-400">{cmd.requested_by || 'admin'}</td>
                    <td className="text-right">
                      {isSuccess ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                          <CheckCircle2 className="size-3.5" /> ESP32 ACK ({cmd.execution_time_ms ?? 50}ms)
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                          <Loader2 className="size-3.5 animate-spin" /> Chờ ESP32 ACK...
                        </span>
                      ) : isTimeout ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                          <AlertTriangle className="size-3.5" /> Timeout (5s)
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-500">{cmd.status}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Safety & Protocol Details */}
      <footer className="rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-xs leading-5 text-slate-400">
        <p className="flex items-center gap-1.5 font-semibold text-slate-300">
          <HelpCircle className="size-4 text-cyan-300" /> Cơ chế an toàn và giao thức IoT:
        </p>
        <p className="mt-1">
          • Chế độ <strong>MANUAL</strong> cho phép phát lệnh xuống Relay và Motor. Mỗi lệnh phát đi sẽ kích hoạt bộ đếm thời gian 5 giây để chờ gói tin xác nhận ACK từ ESP32 Gateway qua MQTT Topic{' '}
          <code className="font-mono text-cyan-300">classroom/P.101/device/+/ack</code>.
        </p>
        <p>
          • Động cơ rèm cửa được trang bị cảm biến giới hạn hành trình (Limit Switch) và tính năng tự động ngắt sau 30 giây để chống kẹt motor.
        </p>
      </footer>
    </section>
  )
}
