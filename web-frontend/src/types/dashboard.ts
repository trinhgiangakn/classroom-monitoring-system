export type MetricTone = 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose'

export interface EnvironmentMetric {
  id: 'temperature' | 'humidity' | 'pressure' | 'light' | 'air-quality'
  label: string
  value: string
  source: string
  trend: string
  tone: MetricTone
}

export interface SensorNode {
  id: string
  position: string
  signalDbm: number | null
  lastSeen: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  light: number | null
  airQuality: string
  status: string
}

export interface EnvironmentPoint {
  time: string
  temperature: number | null
  humidity: number | null
  pressure?: number | null
  light?: number | null
  airQuality?: number | null
}

export interface RecentTelemetry {
  timestamp: string | null
  nodeId: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  light: number | null
  airQualityPpm: number | null
  airQualityStatus: string
  status: string
}

export interface GatewayRuntime {
  gatewayId: string
  status: string
  wifiConnected: boolean
  mqttConnected: boolean
  wifiSignalDbm: number | null
  lastSeen: string
  cpuUsagePercent: number | null
  ramHeapPercent: number | null
  mqttQueuePercent: number | null
}

export interface AlertItem {
  id: string
  title: string
  message: string
  time: string
  severity: 'warning' | 'info' | 'success'
}

export type DeviceId = 'light' | 'fan' | 'humidifier' | 'curtain'

export interface DeviceState {
  id: DeviceId
  label: string
  enabled: boolean
}
