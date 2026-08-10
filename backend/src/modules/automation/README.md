# DEV 4 module

This module uses CommonJS JavaScript so it can be integrated directly into the Node.js/Express backend used by the group. It is framework-independent, so it can be unit-tested with mock ports before DEV 1 adds Express/MySQL, DEV 2 adds MQTT ingestion and DEV 3 adds the MQTT command/ACK adapter.

- DEV 2 calls `AutomationService.handleTelemetry()` after telemetry validation.
- DEV 2 calls `AutomationService.handleNodeStatuses()` after node status changes.
- DEV 3 implements `DeviceCommandPort`.
- The WebSocket server implements `RealtimePort`.

## Run existing unit tests

```powershell
node --test backend/src/modules/automation/__tests__/*.test.js
```
