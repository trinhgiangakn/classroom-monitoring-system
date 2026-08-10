const REALTIME_EVENT = Object.freeze({
  ALERT_NEW: 'alert:new',
  AUTOMATION_ACTION: 'automation:action',
  MODE_UPDATE: 'mode:update',
  NODE_STATUS: 'node:status',
  GATEWAY_STATUS: 'gateway:status',
  SYSTEM_RESOURCE_UPDATE: 'system:resource-update',
});

module.exports = { REALTIME_EVENT };
