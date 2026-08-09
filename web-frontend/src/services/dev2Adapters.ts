import type {
  EnvironmentMetric,
  EnvironmentPoint,
  GatewayRuntime,
  RecentTelemetry,
  SensorNode,
} from '../types/dashboard'
import type {
  GatewayDto,
  HistorySeriesDto,
  LatestSensorDto,
  NodeDto,
  RecentSensorDto,
} from './dev2Api'

function average(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : null
}

function display(value: number | null, unit: string, digits = 1) {
  return value === null ? '—' : `${value.toFixed(digits)} ${unit}`
}

export function toMetrics(latest: LatestSensorDto[]): EnvironmentMetric[] {
  const temperature = average(latest.map(row => row.temperature))
  const humidity = average(latest.map(row => row.humidity))
  const pressure = average(latest.map(row => row.pressure_hpa))
  const light = average(latest.map(row => row.light_lux))
  const airQualityPpm = average(latest.map(row => row.air_quality_ppm))
  const airQuality = latest.find(row => row.air_quality_status)?.air_quality_status || 'Chưa có dữ liệu'
  const liveTrend = 'Dữ liệu trực tiếp từ Backend Dev2'

  return [
    { id: 'temperature', label: 'Nhiệt độ', value: display(temperature, '°C'), source: 'AHT20 · trung bình các node', trend: liveTrend, tone: 'cyan' },
    { id: 'humidity', label: 'Độ ẩm', value: display(humidity, '%', 0), source: 'AHT20 · trung bình các node', trend: liveTrend, tone: 'violet' },
    { id: 'pressure', label: 'Áp suất', value: display(pressure, 'hPa', 0), source: 'BMP280 · trung bình các node', trend: liveTrend, tone: 'emerald' },
    { id: 'light', label: 'Ánh sáng', value: display(light, 'lux', 0), source: 'BH1750 · trung bình các node', trend: liveTrend, tone: 'amber' },
    { id: 'air-quality', label: 'Chất lượng không khí', value: airQualityPpm === null ? airQuality : `${airQuality} · ${airQualityPpm.toFixed(0)} ppm`, source: 'MQ135 · trung bình các node', trend: liveTrend, tone: 'rose' },
  ]
}

export function toHistoryPoints(series: HistorySeriesDto): EnvironmentPoint[] {
  const points = new Map<string, EnvironmentPoint>()
  const definitions = [
    ['temperature', 'temperature'],
    ['humidity', 'humidity'],
    ['pressure', 'pressure'],
    ['light', 'light'],
    ['air_quality', 'airQuality'],
  ] as const

  for (const [seriesKey, pointKey] of definitions) {
    for (const item of series[seriesKey] ?? []) {
      if (!item.timestamp) continue
      const current = points.get(item.timestamp) ?? {
        time: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(item.timestamp)),
        temperature: null,
        humidity: null,
      }
      current[pointKey] = item.value
      points.set(item.timestamp, current)
    }
  }

  return [...points.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, point]) => point)
}

export function toSensorNodes(nodes: NodeDto[], latest: LatestSensorDto[]): SensorNode[] {
  const latestByNode = new Map(latest.map(row => [row.node_id, row]))
  return nodes.map(node => {
    const telemetry = latestByNode.get(node.node_id)
    return {
      id: node.node_id,
      position: node.position || node.node_id,
      signalDbm: node.rssi,
      lastSeen: node.last_seen === 'Chưa nhận dữ liệu' ? node.last_seen : `${node.last_seen} trước`,
      temperature: telemetry?.temperature ?? null,
      humidity: telemetry?.humidity ?? null,
      pressure: telemetry?.pressure_hpa ?? null,
      light: telemetry?.light_lux ?? null,
      airQuality: telemetry?.air_quality_status ?? 'Chưa có dữ liệu',
      status: node.status,
    }
  })
}

export function toRecentTelemetry(rows: RecentSensorDto[]): RecentTelemetry[] {
  return rows.map(row => ({
    timestamp: row.timestamp,
    nodeId: row.node_id,
    temperature: row.temperature,
    humidity: row.humidity,
    pressure: row.pressure_hpa,
    light: row.light_lux,
    airQualityPpm: row.air_quality_ppm,
    airQualityStatus: row.air_quality_status,
    status: row.status,
  }))
}

export function toGatewayRuntime(gateway: GatewayDto): GatewayRuntime {
  return {
    gatewayId: gateway.gateway_id,
    status: gateway.status,
    wifiConnected: gateway.wifi_connected,
    mqttConnected: gateway.mqtt_connected,
    wifiSignalDbm: gateway.wifi_signal_dbm,
    lastSeen: gateway.last_seen,
    cpuUsagePercent: gateway.metrics.cpu_usage_percent,
    ramHeapPercent: gateway.metrics.ram_heap_percent,
    mqttQueuePercent: gateway.metrics.mqtt_queue_percent,
  }
}
