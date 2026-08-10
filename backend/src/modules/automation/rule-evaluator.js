const { COMPARISON } = require('./automation.constants');

/**
 * @param {object} telemetry
 * @param {'temperature'|'humidity'|'light_lux'|'air_quality_ppm'} sensor
 * @returns {number|undefined}
 */
function readSensorValue(telemetry, sensor) {
  const values = {
    temperature: telemetry.temperature,
    humidity: telemetry.humidity,
    light_lux: telemetry.lightLux,
    air_quality_ppm: telemetry.airQualityPpm,
  };
  return values[sensor];
}

function matches(value, comparison, threshold) {
  switch (comparison) {
    case COMPARISON.GT: return value > threshold;
    case COMPARISON.GTE: return value >= threshold;
    case COMPARISON.LT: return value < threshold;
    case COMPARISON.LTE: return value <= threshold;
    default: throw new Error(`Unsupported comparison: ${comparison}`);
  }
}

/**
 * Framework-independent Rule Engine logic for one rule.
 * Rule shape: { id, sensor, enabled, activation, deactivation, delayMs }.
 * State shape: { isActive, candidateDecision?, candidateSince?, lastCommandAt? }.
 */
function evaluateRule(rule, telemetry, currentState, now) {
  if (!rule.enabled) {
    return { ruleId: rule.id, decision: 'SKIP', reason: 'Rule is disabled', nextState: currentState };
  }

  const value = readSensorValue(telemetry, rule.sensor);
  if (value === undefined) {
    return { ruleId: rule.id, decision: 'SKIP', reason: `Missing ${rule.sensor} telemetry`, nextState: currentState };
  }

  let wanted;
  let reason = '';
  if (!currentState.isActive && matches(value, rule.activation.comparison, rule.activation.threshold)) {
    wanted = 'ACTIVATE';
    reason = `${rule.sensor} satisfies activation threshold`;
  }
  if (currentState.isActive && matches(value, rule.deactivation.comparison, rule.deactivation.threshold)) {
    wanted = 'DEACTIVATE';
    reason = `${rule.sensor} satisfies deactivation threshold`;
  }

  if (!wanted) {
    return {
      ruleId: rule.id,
      decision: 'HOLD',
      reason: `${rule.sensor} remains inside the hysteresis band`,
      nextState: { ...currentState, candidateDecision: undefined, candidateSince: undefined },
    };
  }

  if (currentState.candidateDecision !== wanted || !currentState.candidateSince) {
    return {
      ruleId: rule.id,
      decision: 'HOLD',
      reason: `${reason}; delay timer started`,
      nextState: { ...currentState, candidateDecision: wanted, candidateSince: now },
    };
  }

  const elapsedMs = now.getTime() - currentState.candidateSince.getTime();
  if (elapsedMs < rule.delayMs) {
    return {
      ruleId: rule.id,
      decision: 'HOLD',
      reason: `${reason}; waiting ${rule.delayMs - elapsedMs}ms`,
      nextState: currentState,
    };
  }

  return {
    ruleId: rule.id,
    decision: wanted,
    action: wanted === 'ACTIVATE' ? rule.activation.action : rule.deactivation.action,
    reason,
    nextState: { isActive: wanted === 'ACTIVATE', lastCommandAt: now },
  };
}

module.exports = { evaluateRule, matches, readSensorValue };
