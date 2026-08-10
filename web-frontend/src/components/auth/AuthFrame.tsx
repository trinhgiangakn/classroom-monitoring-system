import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Radio, Wifi } from 'lucide-react'

interface AuthFrameProps {
  children: ReactNode
}

export function AuthFrame({ children }: AuthFrameProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#050d1a] p-4 text-slate-100 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-[#091a32] shadow-2xl shadow-black/30 md:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between border-r border-slate-800 bg-[#07172d] p-10 md:flex">
          <div>
            <div className="grid size-11 place-items-center rounded-xl border border-cyan-400/50 bg-cyan-400/10 font-bold text-cyan-300">
              CM
            </div>
            <p className="mt-6 text-xl font-bold tracking-wide text-cyan-300">CLASSROOM MONITORING</p>
            <h1 className="mt-4 max-w-sm text-3xl font-bold leading-tight">
              Hệ thống giám sát và điều khiển phòng học thông minh
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Theo dõi môi trường 4 góc phòng P.101 và điều khiển thiết bị qua Internet.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/30 p-4 text-sm">
            <p className="font-semibold text-cyan-200">PHÒNG P.101</p>
            <p className="mt-3 leading-5 text-slate-300">
              Theo dõi môi trường và điều khiển thiết bị theo thời gian thực.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusChip icon={Radio} label="MQTT: Online" />
              <StatusChip icon={Wifi} label="Gateway: Online" />
            </div>
          </div>
        </section>

        <section className="flex min-h-[620px] items-center p-6 sm:p-10">{children}</section>
      </div>
    </main>
  )
}

function StatusChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  )
}
