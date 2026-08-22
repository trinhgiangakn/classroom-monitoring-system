const { ALERT_SEVERITY } = require('./alert.constants');
const { REALTIME_EVENT } = require('../realtime/realtime.events');

const DEFAULT_METRIC_RULES = Object.freeze([
  {
    field: 'temperature', key: 'temperature', label: 'Nhiệt độ', unit: '°C',
    bands: [
      { type: 'TEMPERATURE_CRITICAL_HIGH', direction: 'HIGH', activation: 35, recovery: 33, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'TEMPERATURE_CRITICAL_LOW', direction: 'LOW', activation: 10, recovery: 12, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'TEMPERATURE_HIGH', direction: 'HIGH', activation: 30, recovery: 28, severity: ALERT_SEVERITY.WARNING },
      { type: 'TEMPERATURE_LOW', direction: 'LOW', activation: 18, recovery: 20, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'humidity', key: 'humidity', label: 'Độ ẩm', unit: '%',
    bands: [
      { type: 'HUMIDITY_CRITICAL_HIGH', direction: 'HIGH', activation: 85, recovery: 80, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'HUMIDITY_CRITICAL_LOW', direction: 'LOW', activation: 20, recovery: 25, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'HUMIDITY_HIGH', direction: 'HIGH', activation: 75, recovery: 70, severity: ALERT_SEVERITY.WARNING },
      { type: 'HUMIDITY_LOW', direction: 'LOW', activation: 35, recovery: 40, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'pressureHpa', key: 'pressure', label: 'Áp suất', unit: 'hPa',
    bands: [
      { type: 'PRESSURE_HIGH', direction: 'HIGH', activation: 1030, recovery: 1025, severity: ALERT_SEVERITY.WARNING },
      { type: 'PRESSURE_LOW', direction: 'LOW', activation: 980, recovery: 985, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'lightLux', key: 'light', label: 'Ánh sáng', unit: 'lux',
    bands: [
      { type: 'LIGHT_HIGH', direction: 'HIGH', activation: 1200, recovery: 1000, severity: ALERT_SEVERITY.WARNING },
      { type: 'LIGHT_LOW', direction: 'LOW', activation: 200, recovery: 300, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'airQualityPpm', key: 'air-quality', label: 'Chất lượng không khí', unit: 'ppm',
    bands: [
      { type: 'AIR_QUALITY_CRITICAL', direction: 'HIGH', activation: 201, recovery: 180, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'AIR_QUALITY_POOR', direction: 'HIGH', activation: 101, recovery: 90, severity: ALERT_SEVERITY.WARNING },
    ],
  },
]);

const DEFAULT_GATEWAY_RULES = Object.freeze([
  {
    field: 'cpuUsagePercent', key: 'cpu', label: 'CPU Gateway', unit: '%',
    bands: [
      { type: 'GATEWAY_CPU_CRITICAL', direction: 'HIGH', activation: 95, recovery: 90, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'GATEWAY_CPU_HIGH', direction: 'HIGH', activation: 85, recovery: 75, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'ramHeapPercent', key: 'ram', label: 'RAM Gateway', unit: '%',
    bands: [
      { type: 'GATEWAY_RAM_CRITICAL', direction: 'HIGH', activation: 95, recovery: 90, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'GATEWAY_RAM_HIGH', direction: 'HIGH', activation: 85, recovery: 75, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'mqttQueuePercent', key: 'mqtt-queue', label: 'MQTT queue', unit: '%',
    bands: [
      { type: 'MQTT_QUEUE_CRITICAL', direction: 'HIGH', activation: 90, recovery: 80, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'MQTT_QUEUE_HIGH', direction: 'HIGH', activation: 70, recovery: 50, severity: ALERT_SEVERITY.WARNING },
    ],
  },
]);

const DEFAULT_NODE_RULES = Object.freeze([
  {
    field: 'batteryPercent', key: 'battery', label: 'Pin', unit: '%',
    bands: [
      { type: 'NODE_BATTERY_CRITICAL', direction: 'LOW', activation: 10, recovery: 15, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'NODE_BATTERY_LOW', direction: 'LOW', activation: 20, recovery: 25, severity: ALERT_SEVERITY.WARNING },
    ],
  },
  {
    field: 'packetSuccessRate', key: 'packet-success', label: 'Tỷ lệ nhận gói', unit: '%',
    bands: [
      { type: 'NODE_PACKET_LOSS_CRITICAL', direction: 'LOW', activation: 70, recovery: 80, severity: ALERT_SEVERITY.CRITICAL },
      { type: 'NODE_PACKET_LOSS_HIGH', direction: 'LOW', activation: 90, recovery: 95, severity: ALERT_SEVERITY.WARNING },
    ],
  },
]);

function activates(value, band) {
  return band.direction === 'HIGH' ? value >= band.activation : value <= band.activation;
}

function remainsActive(value, band) {
  return band.direction === 'HIGH' ? value > band.recovery : value < band.recovery;
}

function classifyBand(value, bands, currentType = null) {
  const currentIndex = currentType ? bands.findIndex((band) => band.type === currentType) : -1;
  const currentBand = currentIndex >= 0 ? bands[currentIndex] : null;
  const escalation = currentIndex > 0
    ? bands.slice(0, currentIndex).find((band) => activates(value, band))
    : null;
  if (escalation) return escalation;
  if (currentBand && remainsActive(value, currentBand)) return currentBand;
  return bands.find((band) => activates(value, band)) ?? null;
}

function displayValue(value) {
  return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
}

function metricAlert(rule, band, value, source, extraMetadata = {}) {
  const relation = band.direction === 'HIGH' ? 'vượt ngưỡng cao' : 'thấp hơn ngưỡng an toàn';
  return {
    type: band.type,
    source,
    severity: band.severity,
    message: `${rule.label} tại ${source} là ${displayValue(value)} ${rule.unit}, ${relation} ${band.activation} ${rule.unit}.`,
    metadata: {
      metric: rule.key,
      value,
      unit: rule.unit,
      direction: band.direction,
      activationThreshold: band.activation,
      recoveryThreshold: band.recovery,
      ...extraMetadata,
    },
  };
}

class MonitoringAlertService {
  constructor({
    alerts,
    realtime,
    metricRules = DEFAULT_METRIC_RULES,
    gatewayRules = DEFAULT_GATEWAY_RULES,
    nodeRules = DEFAULT_NODE_RULES,
  }) {
    if (!alerts?.evaluateCondition) throw new TypeError('AlertService with evaluateCondition is required');
    if (!realtime?.publishToRoom) throw new TypeError('Realtime publisher is required');
    this.alerts = alerts;
    this.realtime = realtime;
    this.metricRules = metricRules;
    this.gatewayRules = gatewayRules;
    this.nodeRules = nodeRules;
  }

  async handleTelemetry({ roomId, nodeId, telemetry }) {
    const source = nodeId || telemetry.nodeId;
    for (const rule of this.metricRules) {
      const value = telemetry[rule.field];
      if (!Number.isFinite(value)) continue;
      await this.#evaluate(roomId, `sensor:${source}:${rule.key}`, (current) => {
        const band = classifyBand(value, rule.bands, current?.type);
        return band ? metricAlert(rule, band, value, source, { nodeId: source }) : null;
      });
    }

    await this.#evaluate(roomId, `sensor:${source}:data-quality`, () => {
      if (telemetry.dataStatus === 'INVALID') {
        return {
          type: 'SENSOR_DATA_INVALID', source, severity: ALERT_SEVERITY.CRITICAL,
          message: `Dữ liệu cảm biến từ ${source} không hợp lệ.`,
          metadata: { nodeId: source, dataStatus: telemetry.dataStatus, errorFlags: telemetry.errorFlags },
        };
      }
      if (telemetry.dataStatus === 'PARTIAL') {
        return {
          type: 'SENSOR_DATA_PARTIAL', source, severity: ALERT_SEVERITY.WARNING,
          message: `Dữ liệu cảm biến từ ${source} đang bị thiếu.`,
          metadata: { nodeId: source, dataStatus: telemetry.dataStatus, errorFlags: telemetry.errorFlags },
        };
      }
      return null;
    });

    await this.#evaluate(roomId, `node:${source}:connectivity`, (current) => {
      if (telemetry.dataStatus === 'INVALID') {
        return {
          type: 'NODE_ERROR', source, severity: ALERT_SEVERITY.CRITICAL,
          message: `${source} đang báo lỗi dữ liệu cảm biến.`,
          metadata: { nodeId: source, dataStatus: telemetry.dataStatus },
        };
      }
      const rssi = telemetry.bleRssi;
      const weakSignalRemains = current?.type === 'NODE_WEAK_SIGNAL' && Number.isFinite(rssi) && rssi < -70;
      if ((Number.isFinite(rssi) && rssi <= -75) || weakSignalRemains) {
        return {
          type: 'NODE_WEAK_SIGNAL', source, severity: ALERT_SEVERITY.WARNING,
          message: `${source} có tín hiệu BLE yếu (${displayValue(rssi)} dBm).`,
          metadata: { nodeId: source, rssi, activationThreshold: -75, recoveryThreshold: -70 },
        };
      }
      return null;
    });
  }

  async handleNodeStatuses({ roomId, statuses }) {
    for (const node of statuses) {
      await this.#evaluate(roomId, `node:${node.nodeId}:connectivity`, (current) => {
        if (node.status === 'OFFLINE') {
          return {
            type: 'NODE_OFFLINE', source: node.nodeId, severity: ALERT_SEVERITY.WARNING,
            message: `${node.nodeId} đã mất kết nối.`,
            metadata: { nodeId: node.nodeId, status: node.status },
          };
        }
        if (node.status === 'ERROR') {
          return {
            type: 'NODE_ERROR', source: node.nodeId, severity: ALERT_SEVERITY.CRITICAL,
            message: `${node.nodeId} đang ở trạng thái lỗi.`,
            metadata: { nodeId: node.nodeId, status: node.status },
          };
        }
        const weakSignalRemains = current?.type === 'NODE_WEAK_SIGNAL'
          && Number.isFinite(node.rssi) && node.rssi < -70;
        if (node.status === 'WEAK_SIGNAL' || (Number.isFinite(node.rssi) && node.rssi <= -75) || weakSignalRemains) {
          return {
            type: 'NODE_WEAK_SIGNAL', source: node.nodeId, severity: ALERT_SEVERITY.WARNING,
            message: `${node.nodeId} có tín hiệu BLE yếu${Number.isFinite(node.rssi) ? ` (${displayValue(node.rssi)} dBm)` : ''}.`,
            metadata: { nodeId: node.nodeId, status: node.status, rssi: node.rssi ?? null },
          };
        }
        return null;
      });

      for (const rule of this.nodeRules) {
        const value = node[rule.field];
        if (!Number.isFinite(value)) continue;
        await this.#evaluate(roomId, `node:${node.nodeId}:${rule.key}`, (current) => {
          const band = classifyBand(value, rule.bands, current?.type);
          return band ? metricAlert(rule, band, value, node.nodeId, { nodeId: node.nodeId }) : null;
        });
      }
    }
  }

  async handleGatewayStatus({ roomId, gateway }) {
    const gatewayId = gateway.gatewayId || 'GW-P101-01';
    await this.#evaluate(roomId, `gateway:${gatewayId}:connectivity`, (current) => {
      if (gateway.status === 'OFFLINE') {
        return {
          type: 'GATEWAY_OFFLINE', source: gatewayId, severity: ALERT_SEVERITY.CRITICAL,
          message: `${gatewayId} đã mất kết nối.`, metadata: { gatewayId, status: gateway.status },
        };
      }
      if (gateway.wifiConnected === false) {
        return {
          type: 'GATEWAY_WIFI_DISCONNECTED', source: gatewayId, severity: ALERT_SEVERITY.CRITICAL,
          message: `${gatewayId} đã mất kết nối Wi-Fi.`, metadata: { gatewayId, wifiConnected: false },
        };
      }
      if (gateway.mqttConnected === false) {
        return {
          type: 'GATEWAY_MQTT_DISCONNECTED', source: gatewayId, severity: ALERT_SEVERITY.WARNING,
          message: `${gatewayId} đã mất kết nối MQTT.`, metadata: { gatewayId, mqttConnected: false },
        };
      }
      if (gateway.status === 'DEGRADED') {
        return {
          type: 'GATEWAY_DEGRADED', source: gatewayId, severity: ALERT_SEVERITY.WARNING,
          message: `${gatewayId} đang hoạt động suy giảm.`, metadata: { gatewayId, status: gateway.status },
        };
      }
      const rssi = gateway.wifiRssi ?? gateway.wifiSignalDbm;
      const weakSignalRemains = current?.type === 'GATEWAY_WIFI_WEAK' && Number.isFinite(rssi) && rssi < -70;
      if ((Number.isFinite(rssi) && rssi <= -75) || weakSignalRemains) {
        return {
          type: 'GATEWAY_WIFI_WEAK', source: gatewayId, severity: ALERT_SEVERITY.WARNING,
          message: `${gatewayId} có tín hiệu Wi-Fi yếu (${displayValue(rssi)} dBm).`,
          metadata: { gatewayId, rssi, activationThreshold: -75, recoveryThreshold: -70 },
        };
      }
      return null;
    });

    for (const rule of this.gatewayRules) {
      const value = gateway[rule.field];
      if (!Number.isFinite(value)) continue;
      await this.#evaluate(roomId, `gateway:${gatewayId}:${rule.key}`, (current) => {
        const band = classifyBand(value, rule.bands, current?.type);
        return band ? metricAlert(rule, band, value, gatewayId, { gatewayId }) : null;
      });
    }
  }

  async #evaluate(roomId, conditionKey, evaluate) {
    const result = await this.alerts.evaluateCondition({ roomId, conditionKey, evaluate });
    if (result.resolved) {
      this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_UPDATED, data: result.resolved });
    }
    if (result.created) {
      this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: result.created });
    }
    return result;
  }
}

module.exports = {
  DEFAULT_GATEWAY_RULES,
  DEFAULT_METRIC_RULES,
  DEFAULT_NODE_RULES,
  MonitoringAlertService,
  classifyBand,
};
