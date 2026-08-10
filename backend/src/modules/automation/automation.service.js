const { REALTIME_EVENT } = require('../realtime/realtime.events');
const { ALERT_SEVERITY } = require('../alerts/alert.constants');
const { evaluateRule } = require('./rule-evaluator');
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
    }

    this.realtime.publishToRoom(roomId, {
      event: REALTIME_EVENT.MODE_UPDATE,
      data: { safeMode: result.currentState, offlineNodeIds: result.offlineNodeIds },
    });
    return result.currentState;
  }

  /**
   * Entry point called by DEV 2 only after a telemetry packet has been validated and persisted.
   * `mode` is kept as a temporary alias for `operationMode` during integration.
   */
  async handleTelemetry({ roomId, operationMode, mode, rule, telemetry, validNodeCount, now = new Date() }) {
    const effectiveRoomId = roomId ?? rule.roomId;
    const effectiveMode = operationMode ?? mode;
    const minValidNodes = rule.minValidNodes ?? 2;

    if (
      effectiveMode !== 'AUTO'
      || this.getSafeMode(effectiveRoomId) === SAFE_MODE_STATE.SAFE_MODE
      || validNodeCount < minValidNodes
    ) {
      return undefined;
    }

    const state = this.runtimeStates.get(rule.id) ?? { isActive: false };
    const evaluation = evaluateRule(rule, telemetry, state, now);
    this.runtimeStates.set(rule.id, evaluation.nextState);
    if (!evaluation.action) return undefined;

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
