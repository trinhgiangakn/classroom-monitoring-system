import { Droplets, LampDesk, Lock, Settings2, VenetianMask, Wind } from 'lucide-react'
import { useState } from 'react'
import { initialDevices } from '../data/mockDashboard'
import type { DeviceId } from '../types/dashboard'

const icons = { light: LampDesk, fan: Wind, humidifier: Droplets, curtain: VenetianMask }

export function DeviceControlPage() {
  const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL')
  const [devices, setDevices] = useState(initialDevices)
  const [curtainState, setCurtainState] = useState('Đang dừng')
  const locked = mode === 'AUTO'

  const toggleDevice = (id: DeviceId) => {
    if (locked || id === 'curtain') return
    setDevices((current) => current.map((device) => device.id === id ? { ...device, enabled: !device.enabled } : device))
  }

  const moveCurtain = (action: 'Mở' | 'Dừng' | 'Đóng') => {
    if (!locked) setCurtainState(action === 'Dừng' ? 'Đang dừng' : `Đang ${action.toLowerCase()}`)
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Điều khiển cục bộ · Mock tương tác</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Điều khiển thiết bị</h1>
          <p className="mt-2 text-sm text-slate-400">Lệnh thật sau này sẽ theo luồng Backend → MQTT → ESP32 Gateway và nhận ACK.</p>
        </div>
        <div className="flex rounded-xl border border-slate-700 bg-slate-950/30 p-1">
          {(['MANUAL', 'AUTO'] as const).map((item) => (
            <button aria-pressed={mode === item} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${mode === item ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-slate-100'}`} key={item} onClick={() => setMode(item)} type="button">{item}</button>
          ))}
        </div>
      </div>

      {locked ? (
        <p className="mt-5 flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100"><Lock aria-hidden="true" className="size-4" /> AUTO đang kích hoạt: các điều khiển thủ công được khóa.</p>
      ) : (
        <p className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">MANUAL đang kích hoạt: bạn có thể thay đổi trạng thái thiết bị trong bản demo.</p>
      )}

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {devices.filter((device) => device.id !== 'curtain').map((device) => {
          const Icon = icons[device.id]
          return (
            <article className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-5" key={device.id}>
              <Icon aria-hidden="true" className="size-6 text-cyan-300" />
              <h2 className="mt-4 font-bold text-slate-100">{device.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{device.enabled ? 'Thiết bị đang hoạt động' : 'Thiết bị đang tắt'}</p>
              <button aria-label={`${device.enabled ? 'Tắt' : 'Bật'} ${device.label}`} aria-pressed={device.enabled} className={`mt-5 w-full rounded-lg px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${device.enabled ? 'bg-cyan-400 text-slate-950' : 'border border-slate-600 text-slate-200 hover:border-cyan-400'}`} disabled={locked} onClick={() => toggleDevice(device.id)} type="button">{device.enabled ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật'}</button>
            </article>
          )
        })}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0c1d37] p-5">
        <div className="flex items-start gap-3"><VenetianMask aria-hidden="true" className="mt-1 size-6 text-amber-300" /><div><h2 className="font-bold text-slate-100">Rèm cửa</h2><p className="mt-1 text-sm text-slate-500">Điều khiển ESP32 qua H-Bridge / motor driver · {curtainState}</p></div></div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {(['Mở', 'Dừng', 'Đóng'] as const).map((action) => <button className="rounded-lg border border-slate-600 px-3 py-2.5 text-sm font-bold text-slate-100 hover:border-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50" disabled={locked} key={action} onClick={() => moveCurtain(action)} type="button">{action}</button>)}
        </div>
      </section>
      <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><Settings2 aria-hidden="true" className="size-3.5" /> Hiện tại chỉ thay đổi state React. Chưa gửi lệnh ra Gateway.</p>
    </section>
  )
}
