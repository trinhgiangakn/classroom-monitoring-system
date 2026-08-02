import { Activity, Database, Radio, Router, Server, Signal } from 'lucide-react'
import { sensorNodes } from '../data/mockDashboard'

const services = [
  { label: 'MQTT Broker', detail: 'Eclipse Mosquitto · QoS 1', icon: Radio, value: 'Online', tone: 'text-emerald-300' },
  { label: 'ESP32 Gateway', detail: 'BLE Scan · Wi-Fi client', icon: Router, value: 'Online', tone: 'text-emerald-300' },
  { label: 'Node.js Backend', detail: 'REST API + WebSocket', icon: Server, value: 'Online', tone: 'text-emerald-300' },
  { label: 'MySQL Database', detail: 'Telemetry · Users · Logs', icon: Database, value: 'Online', tone: 'text-emerald-300' },
]

export function SystemStatusPage() {
  return (
    <section>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Theo dõi kỹ thuật · Mock data</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Trạng thái hệ thống</h1>
        <p className="mt-2 text-sm text-slate-400">Kiểm tra kết nối lớp cảm biến, gateway và dịch vụ máy chủ của phòng P.101.</p>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ label, detail, icon: Icon, value, tone }) => <article className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4" key={label}><Icon aria-hidden="true" className="size-5 text-cyan-300" /><p className="mt-4 font-bold text-slate-100">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p><p className={`mt-4 text-sm font-semibold ${tone}`}>● {value}</p></article>)}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.8fr)]">
        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5">
          <div className="flex items-center gap-2"><Signal aria-hidden="true" className="size-5 text-cyan-300" /><div><h2 className="font-bold text-slate-100">Tình trạng node cảm biến</h2><p className="mt-1 text-xs text-slate-500">BLE advertising theo chu kỳ 5 giây</p></div></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead className="border-b border-slate-700 text-xs text-slate-500"><tr><th className="pb-3">Node</th><th className="pb-3">RSSI</th><th className="pb-3">Lần cuối</th><th className="pb-3">Sensors</th><th className="pb-3">Trạng thái</th></tr></thead><tbody>{sensorNodes.map((node) => <tr className="border-b border-slate-800/80" key={node.id}><td className="py-3 font-semibold text-slate-100">{node.id}</td><td className={node.signalDbm < -75 ? 'text-amber-300' : 'text-emerald-300'}>{node.signalDbm} dBm</td><td className="text-slate-400">{node.lastSeen}</td><td className="text-slate-300">AHT20 · BMP280 · BH1750 · MQ135</td><td className={node.status === 'Online' ? 'text-emerald-300' : 'text-amber-300'}>{node.status}</td></tr>)}</tbody></table></div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5"><div className="flex items-center gap-2"><Activity aria-hidden="true" className="size-5 text-violet-300" /><h2 className="font-bold text-slate-100">Chỉ số vận hành</h2></div><div className="mt-5 space-y-5"><Progress label="Gateway CPU" value="34%" width="34%" tone="bg-cyan-400" /><Progress label="Gateway RAM heap" value="58%" width="58%" tone="bg-violet-400" /><Progress label="MQTT queue" value="12%" width="12%" tone="bg-emerald-400" /></div><div className="mt-6 rounded-xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-sm text-cyan-100"><p className="font-bold">Mục tiêu nghiệm thu</p><p className="mt-1 text-xs">Telemetry 5 giây · độ trễ lệnh mục tiêu ≤ 3 giây.</p></div></section>
      </div>
      <section className="mt-5 rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5"><h2 className="font-bold text-slate-100">Nhật ký kỹ thuật gần đây</h2><div className="mt-4 space-y-2 font-mono text-xs"><p className="text-emerald-300">22:35:07  MQTT Broker connected · QoS 1</p><p className="text-cyan-200">22:35:05  NODE-SE telemetry accepted · 4 sensor flags valid</p><p className="text-amber-300">22:35:03  NODE-NE RSSI -81 dBm · weak BLE signal</p></div></section>
    </section>
  )
}

function Progress({ label, value, width, tone }: { label: string; value: string; width: string; tone: string }) { return <div><div className="flex justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-mono text-slate-400">{value}</span></div><div className="mt-2 h-2 rounded-full bg-slate-800"><div className={`h-full rounded-full ${tone}`} style={{ width }} /></div></div> }
