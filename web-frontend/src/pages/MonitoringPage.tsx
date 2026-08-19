import { Download, Filter, RadioTower } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { environmentSeries as fallbackSeries, sensorNodes as fallbackNodes } from '../data/mockDashboard'
import {
  downloadSensorCsv,
  getLatestSensors,
  getNodes,
  getRecentSensors,
  getSensorHistory,
  type DataType,
  type TimeRange,
} from '../services/dev2Api'
import { toHistoryPoints, toRecentTelemetry, toSensorNodes } from '../services/dev2Adapters'
import type { EnvironmentPoint, RecentTelemetry, SensorNode } from '../types/dashboard'

import { io } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'

const cardClass = 'rounded-2xl border border-slate-800 bg-[#0c1d37] p-4 sm:p-5'
const wsBase = () => API_BASE_URL.replace(/\/api$/, '')

const fallbackRecent: RecentTelemetry[] = fallbackNodes.map(node => ({
  timestamp: null,
  nodeId: node.id,
  temperature: node.temperature,
  humidity: node.humidity,
  pressure: node.pressure,
  light: node.light,
  airQualityPpm: null,
  airQualityStatus: node.airQuality,
  status: node.status === 'Online' ? 'Hợp lệ' : node.status,
}))

const lineDefinitions = {
  temperature: { dataKey: 'temperature', label: 'Nhiệt độ (°C)', color: '#22d3ee' },
  humidity: { dataKey: 'humidity', label: 'Độ ẩm (%)', color: '#a78bfa' },
  pressure: { dataKey: 'pressure', label: 'Áp suất (hPa)', color: '#34d399' },
  light: { dataKey: 'light', label: 'Ánh sáng (lux)', color: '#fbbf24' },
  air_quality: { dataKey: 'airQuality', label: 'Không khí (ppm)', color: '#fb7185' },
} as const

export function MonitoringPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('6h')
  const [nodeId, setNodeId] = useState('all')
  const [dataType, setDataType] = useState<DataType>('all')
  const [series, setSeries] = useState<EnvironmentPoint[]>(fallbackSeries)
  const [nodes, setNodes] = useState<SensorNode[]>(fallbackNodes)
  const [recent, setRecent] = useState<RecentTelemetry[]>(fallbackRecent)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    let active = true

    const loadData = (isInitial = false) => {
      if (isInitial) setLoading(true)
      Promise.all([
        getSensorHistory({ timeRange, nodeId, dataType }),
        getRecentSensors({ timeRange, nodeId, limit: 10 }),
        getLatestSensors(),
        getNodes(),
      ]).then(([history, recentRows, latest, nodeRows]) => {
        if (!active) return
        const liveSeries = toHistoryPoints(history.series)
        setSeries(liveSeries.length ? liveSeries : fallbackSeries)
        const recentTelemetryRows = toRecentTelemetry(recentRows)
        setRecent(recentTelemetryRows.length ? recentTelemetryRows.slice(0, 10) : fallbackRecent)
        setNodes(toSensorNodes(nodeRows, latest))
        setError(null)
      }).catch((reason: unknown) => {
        if (!active) return
        if (isInitial) {
          setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu cảm biến')
          setSeries(fallbackSeries)
          setRecent(fallbackRecent)
          setNodes(fallbackNodes)
        }
      }).finally(() => {
        if (active && isInitial) setLoading(false)
      })
    }

    loadData(true)

    // Auto-polling every 3 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && autoRefresh) {
        loadData(false)
      }
    }, 3000)

    // WebSocket real-time sensor updates
    const socket = io(wsBase(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionDelay: 3000,
    })

    socket.on('connect', () => {
      socket.emit('join-room', 'P.101')
    })

    socket.on('sensor:update', (data: {
      time: string
      node_id: string
      temperature: number | null
      humidity: number | null
      light_lux: number | null
      air_quality: string
      status: string
    }) => {
      if (!active || !data) return
      setRecent(prev => [
        {
          timestamp: new Date().toISOString(),
          nodeId: data.node_id,
          temperature: data.temperature,
          humidity: data.humidity,
          pressure: 1013.25,
          light: data.light_lux,
          airQualityPpm: null,
          airQualityStatus: data.air_quality,
          status: data.status,
        },
        ...prev.slice(0, 9),
      ])

      setNodes(prev => prev.map(n => n.id === data.node_id ? {
        ...n,
        temperature: data.temperature ?? n.temperature,
        humidity: data.humidity ?? n.humidity,
        light: data.light_lux ?? n.light,
        airQuality: data.air_quality || n.airQuality,
        status: 'Online',
      } : n))
    })

    return () => {
      active = false
      clearInterval(interval)
      socket.disconnect()
    }
  }, [autoRefresh, dataType, nodeId, timeRange])

  const selectedLines = dataType === 'all'
    ? [lineDefinitions.temperature, lineDefinitions.humidity]
    : [lineDefinitions[dataType]]

  const exportCsv = async () => {
    try {
      setExportMessage('Đang tạo tệp CSV...')
      await downloadSensorCsv({ timeRange, nodeId })
      setExportMessage('Đã tải tệp CSV thành công.')
    } catch (reason) {
      setExportMessage(reason instanceof Error ? reason.message : 'Không thể xuất CSV')
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              {loading ? 'Đang tải dữ liệu' : error ? 'Dữ liệu tạm thời' : `Trực tiếp · ${recent.length} bản ghi gần nhất`}
            </p>
            {autoRefresh && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                </span>
                Live 3s
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">Giám sát dữ liệu môi trường</h1>
          <p className="mt-2 text-sm text-slate-400">Theo dõi AHT20, BMP280, BH1750 và MQ135 trong phòng P.101.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              autoRefresh 
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' 
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            type="button"
          >
            {autoRefresh ? '🟢 Đang bật Live' : '⚪ Tạm dừng Live'}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20"
            onClick={exportCsv}
            type="button"
          >
            <Download aria-hidden="true" className="size-4" /> Xuất CSV
          </button>
        </div>
      </div>

      {error ? <Notice tone="warning">Không thể kết nối máy chủ: {error}. Đang hiển thị dữ liệu tạm thời.</Notice> : null}
      {exportMessage ? <Notice tone="success">{exportMessage}</Notice> : null}

      <section aria-label="Bộ lọc dữ liệu" className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/25 p-3 md:grid-cols-4">
        <Filter aria-hidden="true" className="m-2 size-4 text-cyan-300" />
        <Select label="Khoảng thời gian" onChange={value => setTimeRange(value as TimeRange)} options={[
          ['6h', '6 giờ qua'], ['24h', '24 giờ qua'], ['7d', '7 ngày qua'], ['30d', '30 ngày qua'],
        ]} value={timeRange} />
        <Select label="Node cảm biến" onChange={setNodeId} options={[
          ['all', 'Tất cả node'], ...nodes.map(node => [node.id, node.id] as [string, string]),
        ]} value={nodeId} />
        <Select label="Loại dữ liệu" onChange={value => setDataType(value as DataType)} options={[
          ['all', 'Nhiệt độ và độ ẩm'], ['temperature', 'Nhiệt độ'], ['humidity', 'Độ ẩm'],
          ['pressure', 'Áp suất'], ['light', 'Ánh sáng'], ['air_quality', 'Chất lượng không khí'],
        ]} value={dataType} />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.9fr)]">
        <section className={cardClass}>
          <h2 className="text-base font-bold text-slate-100">Biểu đồ môi trường — {timeRange}</h2>
          <p className="mt-1 text-xs text-slate-500">{nodeId === 'all' ? 'Trung bình các node hợp lệ' : nodeId}</p>
          <div className="mt-4 h-72">
            {series.length ? (
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#1e3655" strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke="#7b91b0" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#7b91b0" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#07172e', border: '1px solid #28507d', borderRadius: 10 }} />
                  {selectedLines.map(line => (
                    <Line dataKey={line.dataKey} dot={false} key={line.dataKey} name={line.label} stroke={line.color} strokeWidth={3} type="monotone" />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Chưa có dữ liệu tổng hợp cho khoảng thời gian này." />}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-base font-bold text-slate-100">Cường độ ánh sáng</h2>
          <p className="mt-1 text-xs text-slate-500">BH1750 · dữ liệu mới nhất theo node</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={nodes} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#1e3655" strokeDasharray="3 3" />
                <XAxis dataKey="id" stroke="#7b91b0" tick={{ fontSize: 11 }} />
                <YAxis stroke="#7b91b0" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#07172e', border: '1px solid #28507d', borderRadius: 10 }} />
                <Bar dataKey="light" fill="#fbbf24" name="Ánh sáng (lux)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className={`${cardClass} mt-5 overflow-x-auto`}>
        <div className="flex items-center gap-2">
          <RadioTower aria-hidden="true" className="size-4 text-cyan-300" />
          <div>
            <h2 className="text-base font-bold text-slate-100">10 bản ghi gần nhất</h2>
            <p className="mt-1 text-xs text-slate-500">Telemetry thời gian thực lấy trực tiếp từ `/api/sensors/recent`.</p>
          </div>
        </div>
        <table className="mt-4 w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-700 text-xs text-slate-500">
            <tr><th className="pb-3">Thời gian</th><th className="pb-3">Node</th><th className="pb-3">Nhiệt độ</th><th className="pb-3">Độ ẩm</th><th className="pb-3">Áp suất</th><th className="pb-3">Ánh sáng</th><th className="pb-3">MQ135</th><th className="pb-3">Trạng thái</th></tr>
          </thead>
          <tbody>
            {recent.map((row, index) => (
              <tr className="border-b border-slate-800/80 text-slate-300" key={`${row.nodeId}-${row.timestamp ?? index}`}>
                <td className="py-3 font-mono text-xs">{formatTime(row.timestamp)}</td>
                <td className="py-3 font-semibold text-slate-100">{row.nodeId}</td>
                <td>{formatMeasurement(row.temperature, '°C')}</td>
                <td>{formatMeasurement(row.humidity, '%')}</td>
                <td>{formatMeasurement(row.pressure, 'hPa')}</td>
                <td>{formatMeasurement(row.light, 'lux')}</td>
                <td>{row.airQualityPpm === null ? row.airQualityStatus : `${row.airQualityPpm} ppm · ${row.airQualityStatus}`}</td>
                <td className={row.status === 'Hợp lệ' ? 'text-emerald-300' : 'text-amber-300'}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!recent.length ? <EmptyState text="Chưa có bản ghi telemetry trong khoảng đã chọn." /> : null}
      </section>
    </section>
  )
}

function Select({ label, options, value, onChange }: {
  label: string
  options: Array<[string, string]>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <select className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1d37] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" onChange={event => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  )
}

function Notice({ children, tone }: { children: React.ReactNode; tone: 'warning' | 'success' }) {
  const classes = tone === 'warning'
    ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  return <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${classes}`}>{children}</p>
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid h-full place-items-center text-sm text-slate-500">{text}</div>
}

function formatMeasurement(value: number | null, unit: string) {
  return value === null ? '—' : `${value} ${unit}`
}

function formatTime(timestamp: string | null) {
  if (!timestamp) return 'Dữ liệu dự phòng'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(timestamp))
}
