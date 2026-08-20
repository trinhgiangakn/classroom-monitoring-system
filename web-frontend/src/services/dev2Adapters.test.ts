import { describe, expect, it } from 'vitest'
import { toDashboardAlert, toHistoryPoints, toMetrics, toSensorNodes } from './dev2Adapters'
import type { AlertDto } from './alertApi'
import type { LatestSensorDto, NodeDto } from './dev2Api'

const latest: LatestSensorDto[] = [{
  node_id: 'NODE-NW',
  temperature: 28.2,
  humidity: 58,
  pressure_hpa: 1008,
  light_lux: 420,
  air_quality_ppm: 75,
  air_quality_status: 'Bình thường',
  status: 'Hợp lệ',
  timestamp: '2026-08-10T00:00:00.000Z',
}]

const nodes: NodeDto[] = [{
  node_id: 'NODE-NW',
  status: 'Online',
  rssi: -57,
  packet_success_rate: 99.4,
  last_seen: '2 giây',
  sensor_health: 'OK',
  position: 'Góc Tây Bắc',
}]

describe('Dev2 frontend adapters', () => {
  it('normalizes workflow alerts for the dashboard alert list', () => {
    const alert: AlertDto = {
      id: '173',
      room_id: 'P.101',
      type: 'GATEWAY_OFFLINE',
      severity: 'CRITICAL',
      source: 'GW-P101-01',
      condition_key: 'gateway:GW-P101-01:connectivity',
      message: 'Gateway đã mất kết nối.',
      status: 'NEW',
      metadata: null,
      created_at: '2026-08-17T10:46:36.000Z',
      acknowledged_by: null,
      acknowledged_at: null,
      resolved_by: null,
      resolved_at: null,
    }

    expect(toDashboardAlert(alert)).toMatchObject({
      id: '173',
      title: 'Cảnh báo GW-P101-01',
      severity: 'warning',
      message: 'Gateway đã mất kết nối.',
    })
  })

  it('turns latest telemetry into dashboard metrics', () => {
    const metrics = toMetrics(latest)
    expect(metrics.find(metric => metric.id === 'temperature')?.value).toBe('28.2 °C')
    expect(metrics.find(metric => metric.id === 'pressure')?.value).toBe('1008 hPa')
    expect(metrics.find(metric => metric.id === 'air-quality')?.value).toContain('75 ppm')
  })

  it('joins node health with its latest telemetry', () => {
    expect(toSensorNodes(nodes, latest)[0]).toMatchObject({
      id: 'NODE-NW',
      position: 'Góc Tây Bắc',
      temperature: 28.2,
      signalDbm: -57,
      status: 'Online',
    })
  })

  it('merges separate history series by timestamp', () => {
    const points = toHistoryPoints({
      temperature: [{ timestamp: '2026-08-10T00:00:00.000Z', value: 28.2 }],
      humidity: [{ timestamp: '2026-08-10T00:00:00.000Z', value: 58 }],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ temperature: 28.2, humidity: 58 })
  })
})
