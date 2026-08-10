const { REALTIME_EVENT } = require('../realtime/realtime.events');
const { evaluateRule } = require('./rule-evaluator');
const { evaluateSafeMode, SAFE_MODE_STATE } = require('./safe-mode.service');

/**
 * Dependencies:
 * - alerts: DEV 4 AlertService
 * - realtime: { publishToRoom(roomId, event) }
 * - deviceCommands: DEV 3 adapter with sendAutomationCommand(action)
 */
class AutomationService {
  constructor({ alerts, realtime, deviceCommands }) {
    this.alerts = alerts;
    this.realtime = realtime;
    this.deviceCommands = deviceCommands;
    this.runtimeStates = new Map();
    this.safeMode = SAFE_MODE_STATE.NORMAL;
  }

  async handleNodeStatuses(roomId, statuses) {
    const result = evaluateSafeMode(roomId, statuses, this.safeMode);
    this.safeMode = result.currentState;
    if (!result.changed) return this.safeMode;

    if (result.currentState === SAFE_MODE_STATE.SAFE_MODE) {
      const alert = await this.alerts.create({
        roomId,
        severity: 'CRITICAL',
        source: 'SAFE_MODE',
        message: `Safe Mode activated: ${result.offlineNodeIds.length} sensor nodes are offline`,
      });
      this.realtime.publishToRoom(roomId, { event: REALTIME_EVENT.ALERT_NEW, data: alert });
    }

    this.realtime.publishToRoom(roomId, {
      event: REALTIME_EVENT.MODE_UPDATE,
      data: { safeMode: this.safeMode, offlineNodeIds: result.offlineNodeIds },
    });
    return this.safeMode;
  }

  async handleTelemetry({ mode, rule, telemetry, validNodeCount, now = new Date() }) {
    if (mode !== 'AUTO' || this.safeMode === SAFE_MODE_STATE.SAFE_MODE || validNodeCount < rule.minValidNodes) return undefined;

    const state = this.runtimeStates.get(rule.id) ?? { isActive: false };
    const evaluation = evaluateRule(rule, telemetry, state, now);
    this.runtimeStates.set(rule.id, evaluation.nextState);
    if (!evaluation.action) return undefined;

    const baseAction = {
      ruleId: rule.id,
      roomId: rule.roomId,
      deviceId: rule.deviceId,
      action: evaluation.action,
      source: 'AUTOMATION',
      reason: evaluation.reason,
      createdAt: now,
    };
    const command = await this.deviceCommands.sendAutomationCommand(baseAction);
    const action = { ...baseAction, ...command };
    this.realtime.publishToRoom(rule.roomId, { event: REALTIME_EVENT.AUTOMATION_ACTION, data: action });
    return action;
  }
}

module.exports = { AutomationService };
