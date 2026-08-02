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
  id: 'NODE-NW' | 'NODE-NE' | 'NODE-SW' | 'NODE-SE'
  position: string
  signalDbm: number
  lastSeen: string
  temperature: number
  humidity: number
  pressure: number
  light: number
  airQuality: string
  status: 'Online' | 'Tín hiệu yếu'
}

export interface EnvironmentPoint {
  time: string
  temperature: number
  humidity: number
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
