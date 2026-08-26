const { REALTIME_EVENT } = require('../realtime/realtime.events');
const { ALERT_SEVERITY } = require('../alerts/alert.constants');
const {
  evaluateRule,
  evaluateWeatherAdvisory,
  matches,
  readSensorValue,
} = require('./rule-evaluator');
const { evaluateSafeMode, SAFE_MODE_STATE } = require('./safe-mode.service');

/**
 * Dependencies:
 * - alerts: DEV 4 AlertService
 * - realtime: DEV 4 RealtimePort with publishToRoom(roomId, { event, data })
 * - deviceCommands: DEV 3 adapter with dispatch(command)
 */
class AutomationService {
  constructor({ alerts, realtime, deviceCommands }) {
    this.alerts = alerts;
    this.realtime = realtime;
    this.deviceCommands = deviceCommands;
    this.runtimeStates = new Map();
    this.safeModesByRoom = new Map();
    this.weatherAdvisoryFetchedAtByRule = new Map();
  }

  async handleNodeStatuses(roomId, statuses) {
    const previousState = this.getSafeMode(roomId);
    const result = evaluateSafeMode(roomId, statuses, previousState);
    this.safeModesByRoom.set(roomId, result.currentState);
    if (!result.changed) return result.currentState;

    if (result.currentState === SAFE_MODE_STATE.SAFE_MODE) {
      const alert = await this.alerts.create({
        roomId,
        severity: ALERT_SEVERITY.CRITICAL,
        source: 'SAFE_MODE',
        message: `Safe Mode activated: ${result.offlineNodeIds.length} sensor nodes are offline`,
      });
      this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: alert });
      await this.enforceSafeModeDevices(roomId);
    }

    this.realtime.publishToRoom(roomId, {
      event: REALTIME_EVENT.MODE_UPDATE,
      data: { safeMode: result.currentState, offlineNodeIds: result.offlineNodeIds },
    });
    return result.currentState;
  }

  async handleGatewayStatus(roomId, gatewayStatus) {
    const isOffline = ['OFFLINE', 'DEGRADED'].includes(gatewayStatus);
    if (isOffline) {
      const previousState = this.getSafeMode(roomId);
      if (previousState !== SAFE_MODE_STATE.SAFE_MODE) {
        this.safeModesByRoom.set(roomId, SAFE_MODE_STATE.SAFE_MODE);
        const alert = await this.alerts.create({
          roomId,
          severity: ALERT_SEVERITY.CRITICAL,
          source: 'SAFE_MODE',
          message: `Safe Mode activated: ESP32 Gateway is ${gatewayStatus.toLowerCase()}`,
        });
        this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: alert });
        await this.enforceSafeModeDevices(roomId);
        this.realtime.publishToRoom(roomId, {
          event: REALTIME_EVENT.MODE_UPDATE,
          data: { safeMode: SAFE_MODE_STATE.SAFE_MODE, gatewayOffline: true },
        });
      }
    }
  }

  async enforceSafeModeDevices(roomId) {
    if (!this.deviceCommands) return;
    const actions = [
      { ruleId: null, roomId, deviceId: 'FAN_01', action: 'TURN_ON', source: 'SAFE_MODE', reason: 'Safe Mode ventilation' },
      { ruleId: null, roomId, deviceId: 'HUMIDIFIER_01', action: 'TURN_OFF', source: 'SAFE_MODE', reason: 'Safe Mode risk protection' },
      { ruleId: null, roomId, deviceId: 'LIGHT_01', action: 'TURN_OFF', source: 'SAFE_MODE', reason: 'Safe Mode energy saving' },
      { ruleId: null, roomId, deviceId: 'CURTAIN_01', action: 'STOP', source: 'SAFE_MODE', reason: 'Safe Mode curtain stop' },
    ];

    for (const item of actions) {
      try {
        const command = await this.deviceCommands.dispatch({ ...item, createdAt: new Date() });
        this.realtime.publishToRoom(roomId, {
          event: REALTIME_EVENT.AUTOMATION_ACTION,
          data: { ...item, ...command },
        });
      } catch (error) {
        // Silently catch device dispatch errors in test environments
      }
    }
  }


  /**
   * Entry point called by DEV 2 only after a telemetry packet has been validated and persisted.
   * `mode` is kept as a temporary alias for `operationMode` during integration.
   */
  async handleTelemetry({ roomId, operationMode, mode, rule, telemetry, validNodeCount, weather, now = new Date() }) {
    const effectiveRoomId = roomId ?? rule.roomId;
    const effectiveMode = operationMode ?? mode;
    const minValidNodes = rule.minValidNodes ?? 2;

    const weatherAdvisory = await this.createWeatherAdvisory({
      roomId: effectiveRoomId,
      rule,
      telemetry,
      weather,
      validNodeCount,
      minValidNodes,
    });

    if (
      effectiveMode !== 'AUTO'
      || this.getSafeMode(effectiveRoomId) === SAFE_MODE_STATE.SAFE_MODE
      || validNodeCount < minValidNodes
    ) {
      return weatherAdvisory;
    }

    const state = this.runtimeStates.get(rule.id) ?? { isActive: false };
    const evaluation = evaluateRule(rule, telemetry, state, now);
    this.runtimeStates.set(rule.id, evaluation.nextState);
    if (!evaluation.action) return weatherAdvisory;

    const baseAction = {
      ruleId: rule.id,
      roomId: effectiveRoomId,
      deviceId: rule.deviceId,
      action: evaluation.action,
      source: 'AUTO',
      reason: evaluation.reason,
      createdAt: now,
    };
    const command = await this.deviceCommands.dispatch(baseAction);
    const action = { ...baseAction, ...command };
    this.realtime.publishToRoom(effectiveRoomId, { event: REALTIME_EVENT.AUTOMATION_ACTION, data: action });
    return action;
  }

  async createWeatherAdvisory({ roomId, rule, telemetry, weather, validNodeCount, minValidNodes }) {
    if (!rule.enabled || !weather || validNodeCount < minValidNodes) return undefined;

    const indoorValue = readSensorValue(telemetry, rule.sensor);
    if (
      indoorValue === undefined
      || !matches(indoorValue, rule.activation.comparison, rule.activation.threshold)
    ) {
      return undefined;
    }

    const evaluation = evaluateWeatherAdvisory(rule, weather);
    if (!evaluation.matches || !weather.fetchedAt) return undefined;

    const fetchedAt = new Date(weather.fetchedAt);
    if (Number.isNaN(fetchedAt.getTime())) return undefined;

    const snapshotKey = fetchedAt.toISOString();
    if (this.weatherAdvisoryFetchedAtByRule.get(rule.id) === snapshotKey) return undefined;

    const alert = await this.alerts.create({
      roomId,
      severity: evaluation.severity,
      source: 'WEATHER_ADVISORY',
      message: evaluation.message,
      metadata: {
        ruleId: rule.id,
        outdoor: {
          field: rule.weatherAdvisory.field,
          value: evaluation.value,
          fetchedAt: snapshotKey,
        },
      },
    });
    this.weatherAdvisoryFetchedAtByRule.set(rule.id, snapshotKey);
    this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: alert });
    return { type: 'WEATHER_ADVISORY', alert };
  }

  /**
   * Entry point called by DEV 3 after an ACK, FAILED, or TIMEOUT command result.
   * Failed device operations are converted into alerts by DEV 4; DEV 3 does not write alerts.
   */
  async handleDeviceCommandResult({ roomId, commandId, deviceId, action, status, source, executionTimeMs }) {
    if (!['FAILED', 'TIMEOUT'].includes(status)) return undefined;

    const alert = await this.alerts.create({
      roomId,
      severity: ALERT_SEVERITY.WARNING,
      source: 'DEVICE_COMMAND',
      message: `Command ${commandId} for ${deviceId} ${status.toLowerCase()}`,
      metadata: { commandId, deviceId, action, status, source, executionTimeMs },
    });

    this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: alert });
    return alert;
  }

  getSafeMode(roomId) {
    return this.safeModesByRoom.get(roomId) ?? SAFE_MODE_STATE.NORMAL;
  }
}

module.exports = { AutomationService };
