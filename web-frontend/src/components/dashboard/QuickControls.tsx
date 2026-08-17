import { Droplets, LampDesk, Loader2, Lock, Radio, VenetianMask, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
import { controlDevice, getDevices, setOperationMode, type DeviceDto } from '../../services/deviceApi'

const icons: Record<string, typeof LampDesk> = {
  LIGHT_01: LampDesk,
  RELAY_1: LampDesk,
  FAN_01: Wind,
  RELAY_2: Wind,
  HUMIDIFIER_01: Droplets,
  RELAY_3: Droplets,
  CURTAIN_01: VenetianMask,
  CURTAIN_MOTOR: VenetianMask,
}

export function QuickControls() {
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [devices, setDevices] = useState<DeviceDto[]>([])
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isChangingMode, setIsChangingMode] = useState(false)

  const loadDevices = async () => {
    try {
      const res = await getDevices()
      setMode(res.operation_mode)
      setDevices(res.devices)
    } catch {
      // Keep previous state if network glitch occurs
    }
  }

  useEffect(() => {
    let active = true
    loadDevices()

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && active) {
        loadDevices()
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
      await setOperationMode(targetMode)
      setMode(targetMode)
      await loadDevices()
    } catch (err) {
      console.error('Lỗi chuyển chế độ:', err)
    } finally {
      setIsChangingMode(false)
    }
  }

  const handleToggle = async (device: DeviceDto) => {
    if (mode === 'AUTO') return
    const isMotor = device.type === 'MOTOR' || device.device_id.includes('CURTAIN')

    let action: 'TURN_ON' | 'TURN_OFF' | 'OPEN' | 'CLOSE'
    if (isMotor) {
      action = device.actual_state === 'OPENING' ? 'CLOSE' : 'OPEN'
    } else {
      action = device.actual_state === 'ON' ? 'TURN_OFF' : 'TURN_ON'
    }

    setPendingId(device.device_id)
    try {
      await controlDevice(device.device_id, action)
      setDevices((prev) =>
        prev.map((d) =>
          d.device_id === device.device_id
            ? { ...d, actual_state: action === 'TURN_ON' ? 'ON' : action === 'OPEN' ? 'OPENING' : action === 'CLOSE' ? 'CLOSING' : 'OFF' }
            : d
        )
      )
      setTimeout(loadDevices, 800)
    } catch (err) {
      console.error('Lỗi điều khiển thiết bị:', err)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100">Điều khiển nhanh</h2>
            <span className="flex items-center gap-1 rounded bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
              <Radio className="size-2.5 animate-pulse" /> Live MQTT
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {mode === 'AUTO' ? 'Khóa điều khiển tay (Chế độ AUTO)' : 'Can thiệp thủ công (Chế độ MANUAL)'}
          </p>
        </div>

        <div className="flex rounded-lg border border-slate-700 bg-slate-950/40 p-1 text-xs">
          {(['MANUAL', 'AUTO'] as const).map((item) => (
            <button
              className={`rounded-md px-3 py-1 font-bold transition disabled:opacity-50 ${
                mode === item ? 'bg-cyan-400 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-100'
              }`}
              disabled={isChangingMode}
              key={item}
              onClick={() => handleModeChange(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {mode === 'AUTO' ? (
        <p className="mt-3.5 flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          <Lock className="size-3.5" /> AUTO đang kích hoạt: thao tác điều khiển thủ công bị khóa.
        </p>
      ) : null}

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        {devices.map((device) => {
          const Icon = icons[device.device_id] || LampDesk
          const isMotor = device.type === 'MOTOR' || device.device_id.includes('CURTAIN')
          const isActive = isMotor ? device.actual_state === 'OPENING' : device.actual_state === 'ON'
          const isPending = pendingId === device.device_id

          return (
            <button
              aria-pressed={isActive}
              className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition ${
                isActive
                  ? 'border-cyan-400/40 bg-gradient-to-r from-cyan-950/30 to-[#0c2a52] text-cyan-100 shadow'
                  : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={mode === 'AUTO' || isPending}
              key={device.device_id}
              onClick={() => handleToggle(device)}
              type="button"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium">
                <Icon aria-hidden="true" className={`size-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                {device.name}
              </span>
              <span className="text-xs font-bold font-mono">
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-amber-300" />
                ) : isMotor ? (
                  isActive ? 'MỞ' : 'ĐÓNG'
                ) : isActive ? (
                  <span className="text-emerald-400">BẬT</span>
                ) : (
                  <span className="text-slate-500">TẮT</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
