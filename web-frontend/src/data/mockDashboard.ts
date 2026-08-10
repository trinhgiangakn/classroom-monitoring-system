import type {
  AlertItem,
  DeviceState,
  EnvironmentMetric,
  EnvironmentPoint,
  SensorNode,
} from '../types/dashboard'

export const roomName = 'Phòng P.101'

export const metrics: EnvironmentMetric[] = [
  {
    id: 'temperature',
    label: 'Nhiệt độ',
    value: '28.2 °C',
    source: 'AHT20 · trung bình 4 node',
    trend: '↓ 0.4 °C so với 1 giờ trước',
    tone: 'cyan',
  },
  {
    id: 'humidity',
    label: 'Độ ẩm',
    value: '58 %',
    source: 'AHT20 · trung bình 4 node',
    trend: 'Ổn định trong ngưỡng',
    tone: 'violet',
  },
  {
    id: 'pressure',
    label: 'Áp suất',
    value: '1008 hPa',
    source: 'BMP280 · trung bình 4 node',
    trend: 'Bình thường',
    tone: 'emerald',
  },
  {
    id: 'light',
    label: 'Ánh sáng',
    value: '420 lux',
    source: 'BH1750 · trung bình 4 node',
    trend: 'Đủ cho lớp học',
    tone: 'amber',
  },
  {
    id: 'air-quality',
    label: 'Chất lượng không khí',
    value: 'Bình thường',
    source: 'MQ135 · mức tương đối',
    trend: 'Không có cảnh báo',
    tone: 'rose',
  },
]

export const sensorNodes: SensorNode[] = [
  {
    id: 'NODE-NW',
    position: 'Góc Tây Bắc',
    signalDbm: -57,
    lastSeen: '2 giây trước',
    temperature: 28.1,
    humidity: 57,
    pressure: 1008,
    light: 418,
    airQuality: 'Bình thường',
    status: 'Online',
  },
  {
    id: 'NODE-NE',
    position: 'Góc Đông Bắc',
    signalDbm: -81,
    lastSeen: '4 giây trước',
    temperature: 28.5,
    humidity: 59,
    pressure: 1007,
    light: 405,
    airQuality: 'Bình thường',
    status: 'Tín hiệu yếu',
  },
  {
    id: 'NODE-SW',
    position: 'Góc Tây Nam',
    signalDbm: -62,
    lastSeen: '3 giây trước',
    temperature: 28.1,
    humidity: 57,
    pressure: 1008,
    light: 418,
    airQuality: 'Bình thường',
    status: 'Online',
  },
  {
    id: 'NODE-SE',
    position: 'Góc Đông Nam',
    signalDbm: -59,
    lastSeen: '1 giây trước',
    temperature: 28.3,
    humidity: 58,
    pressure: 1009,
    light: 427,
    airQuality: 'Bình thường',
    status: 'Online',
  },
]

export const environmentSeries: EnvironmentPoint[] = [
  { time: '16:00', temperature: 27.7, humidity: 60 },
  { time: '17:00', temperature: 27.9, humidity: 59 },
  { time: '18:00', temperature: 28.1, humidity: 60 },
  { time: '19:00', temperature: 28.0, humidity: 59 },
  { time: '20:00', temperature: 28.4, humidity: 58 },
  { time: '21:00', temperature: 28.1, humidity: 58 },
  { time: '22:00', temperature: 28.2, humidity: 58 },
]

export const initialDevices: DeviceState[] = [
  { id: 'light', label: 'Đèn chiếu', enabled: true },
  { id: 'fan', label: 'Quạt thông gió', enabled: true },
  { id: 'humidifier', label: 'Máy cấp ẩm', enabled: false },
  { id: 'curtain', label: 'Rèm cửa', enabled: false },
]

export const alerts: AlertItem[] = [
  {
    id: 'signal',
    title: 'Tín hiệu yếu',
    message: 'NODE-NE có BLE RSSI -81 dBm.',
    time: '2 phút trước',
    severity: 'warning',
  },
  {
    id: 'auto',
    title: 'Chế độ vận hành',
    message: 'Hệ thống đang ở chế độ MANUAL.',
    time: '15 phút trước',
    severity: 'info',
  },
  {
    id: 'gateway',
    title: 'Gateway kết nối',
    message: 'ESP32 Gateway đã kết nối MQTT thành công.',
    time: '32 phút trước',
    severity: 'success',
  },
]
