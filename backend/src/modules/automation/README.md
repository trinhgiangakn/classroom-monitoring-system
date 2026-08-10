# DEV 4 module

This module uses CommonJS JavaScript so it can be integrated directly into the Node.js/Express backend used by the group. It is framework-independent, so it can be unit-tested with mock ports before DEV 1 adds Express/MySQL, DEV 2 adds MQTT ingestion and DEV 3 adds the MQTT command/ACK adapter.

- DEV 2 calls `AutomationService.handleTelemetry()` only after telemetry validation and persistence.
- DEV 2 calls `AutomationService.handleNodeStatuses()` after node status changes.
- DEV 3 implements `DeviceCommandPort.dispatch(command)` and calls
  `AutomationService.handleDeviceCommandResult(result)` after a FAILED or TIMEOUT ACK result.
- DEV 4 provides `RealtimePort`; the WebSocket server uses `createRealtimePublisher(io)`.

## Integration contract (must be shared by DEV 1–DEV 4)

```js
// DEV 2 -> DEV 4
await automationService.handleTelemetry({
  roomId: 'P.101',
  operationMode: 'AUTO',
  rule,
  telemetry,
  validNodeCount: 4,
});

// DEV 4 -> DEV 3
await deviceCommandService.dispatch({
  roomId: 'P.101',
  deviceId: 'FAN_01',
  action: 'TURN_ON',
  source: 'AUTO',
  requestedBy: 'rule-engine',
  ruleId: 'RULE_FAN_01',
});

// DEV 3 -> DEV 4
await automationService.handleDeviceCommandResult({
  roomId: 'P.101',
  commandId: 'CMD-001',
  deviceId: 'FAN_01',
  action: 'TURN_ON',
  status: 'FAILED', // or TIMEOUT
  source: 'AUTO',
  executionTimeMs: 0,
});
```

Safe Mode is stored by `roomId`. When at least two sensor nodes are offline,
the Rule Engine stops issuing AUTO commands and emits `mode:update` plus a
critical alert. It does not force an abrupt power-off of relays.

## Run existing unit tests

```powershell
node --test backend/src/modules/automation/__tests__/*.test.js
```
