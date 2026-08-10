import { Droplets, LampDesk, Settings2, Wind, VenetianMask } from 'lucide-react'
import { useState } from 'react'
import { initialDevices } from '../../data/mockDashboard'
import type { DeviceId } from '../../types/dashboard'

const icons = {
  light: LampDesk,
  fan: Wind,
  humidifier: Droplets,
  curtain: VenetianMask,
}

export function QuickControls() {
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [devices, setDevices] = useState(initialDevices)

  const toggleDevice = (id: DeviceId) => {
    if (mode === 'AUTO') return

    setDevices((current) =>
      current.map((device) =>
        device.id === id ? { ...device, enabled: !device.enabled } : device,
      ),
    )
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-100">Điều khiển nhanh</h2>
          <p className="mt-1 text-xs text-slate-500">Demo cục bộ · chưa gửi lệnh Gateway</p>
        </div>
        <div className="flex rounded-lg border border-slate-700 p-1 text-xs">
          {(['MANUAL', 'AUTO'] as const).map((item) => (
            <button
              className={`rounded-md px-3 py-1.5 font-semibold transition ${
                mode === item ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'
              }`}
              key={item}
              onClick={() => setMode(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {mode === 'AUTO' ? (
        <p className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
          AUTO đang được chọn: thao tác điều khiển thủ công sẽ bị khóa.
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {devices.map((device) => {
          const Icon = icons[device.id]
          return (
            <button
              aria-pressed={device.enabled}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
                device.enabled
                  ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                  : 'border-slate-700 bg-slate-950/30 text-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={mode === 'AUTO'}
              key={device.id}
              onClick={() => toggleDevice(device.id)}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon aria-hidden="true" className="size-4" />
                {device.label}
              </span>
              <span className="text-xs font-bold">{device.enabled ? 'BẬT' : 'TẮT'}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Settings2 aria-hidden="true" className="size-3.5" />
        Lệnh thật sẽ đi từ Backend → MQTT → ESP32 Gateway và nhận ACK.
      </p>
    </section>
  )
}
