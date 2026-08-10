const OPERATION_MODE = Object.freeze({ AUTO: 'AUTO', MANUAL: 'MANUAL' });
const RULE_SENSOR = Object.freeze({
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  LIGHT_LUX: 'light_lux',
  AIR_QUALITY_PPM: 'air_quality_ppm',
});
const COMPARISON = Object.freeze({ GT: 'GT', GTE: 'GTE', LT: 'LT', LTE: 'LTE' });
const RULE_ACTION = Object.freeze({ TURN_ON: 'TURN_ON', TURN_OFF: 'TURN_OFF', OPEN: 'OPEN', CLOSE: 'CLOSE' });

module.exports = { OPERATION_MODE, RULE_SENSOR, COMPARISON, RULE_ACTION };
