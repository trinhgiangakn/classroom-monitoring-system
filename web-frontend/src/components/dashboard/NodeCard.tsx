import { Signal } from 'lucide-react'
import type { SensorNode } from '../../types/dashboard'

export function NodeCard({ node }: { node: SensorNode }) {
  const signalTone = node.status === 'Online' ? 'text-emerald-300' : 'text-amber-300'
  const value = (measurement: number | null, unit: string) => measurement === null ? '—' : `${measurement} ${unit}`

  return (
    <article className="rounded-xl border border-slate-800 bg-[#091a32] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold text-cyan-300">{node.id}</p>
          <p className="mt-1 text-xs text-slate-500">{node.position}</p>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold ${signalTone}`}>
          <Signal aria-hidden="true" className="size-4" />
          {node.signalDbm === null ? '—' : `${node.signalDbm} dBm`}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
        <DataPair label="AHT20" value={`${value(node.temperature, '°C')} · ${value(node.humidity, '%')}`} />
        <DataPair label="BMP280" value={value(node.pressure, 'hPa')} />
        <DataPair label="BH1750" value={value(node.light, 'lux')} />
        <DataPair label="MQ135" value={node.airQuality} />
      </div>
      <p className="mt-3 border-t border-slate-800 pt-3 text-xs text-slate-500">Cập nhật {node.lastSeen}</p>
    </article>
  )
}

function DataPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-200">{value}</p>
    </div>
  )
}
