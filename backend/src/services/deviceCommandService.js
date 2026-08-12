const { randomUUID } = require('node:crypto');

const ROOM_ID = 'P.101';
const MANUAL_ACTIONS = new Set(['TURN_ON', 'TURN_OFF', 'OPEN', 'CLOSE', 'STOP']);

class DeviceCommandError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DeviceCommandError';
    this.statusCode = statusCode;
  }
}

/**
 * DEV 3 command application service.
 *
 * Both HTTP Manual requests and DEV 4 AUTO rules call `dispatch`.  MQTT ACK
 * handling calls `handleAck`.  This keeps command persistence, timeout logic,
 * WebSocket updates and alert notifications in one place.
 */
class DeviceCommandService {
  constructor({
    app,
    devices,
    publishCommand,
    roomId = ROOM_ID,
    ackTimeoutMs = 5_000,
    now = () => new Date(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    logger = console,
  }) {
    if (!app) throw new TypeError('Express app is required');
    if (!devices) throw new TypeError('device repository service is required');
    if (typeof publishCommand !== 'function') throw new TypeError('publishCommand is required');
    this.app = app;
    this.devices = devices;
    this.publishCommand = publishCommand;
    this.roomId = roomId;
    this.ackTimeoutMs = ackTimeoutMs;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.logger = logger;
    this.pendingTimers = new Map();
  }

  async dispatch({ deviceId, action, source, requestedBy, roomId = this.roomId, reason = null }) {
    if (!deviceId) throw new DeviceCommandError('deviceId is required');
    if (!MANUAL_ACTIONS.has(action)) {
      throw new DeviceCommandError('Unsupported device action');
    }
    if (!['MANUAL', 'AUTO'].includes(source)) {
      throw new DeviceCommandError('source must be MANUAL or AUTO');
    }

    const device = await this.devices.getDeviceById(deviceId);
    if (!device) throw new DeviceCommandError('Device not found', 404);
    if (source === 'MANUAL' && device.operation_mode !== 'MANUAL') {
      throw new DeviceCommandError('Room is currently in AUTO mode. Switch to MANUAL mode before issuing manual controls.', 403);
    }

    const commandId = `CMD-${randomUUID()}`;
    const actor = requestedBy || (source === 'AUTO' ? 'automation-engine' : 'unknown-user');
    await this.devices.createCommand({ commandId, deviceId, action, requestedBy: actor, source });

    const published = this.publishCommand(deviceId, {
      command_id: commandId,
      device_id: deviceId,
      action,
      requested_by: actor,
      source,
      reason,
      timestamp: Math.floor(this.now().getTime() / 1000),
    });

    if (!published) {
      await this.#finish(commandId, {
        roomId,
        deviceId,
        action,
        source,
        status: 'FAILED',
        reason: 'MQTT_UNAVAILABLE',
      });
      throw new DeviceCommandError('MQTT gateway is unavailable', 503);
    }

    this.pendingTimers.set(commandId, this.setTimer(() => {
      void this.#handleTimeout({ commandId, roomId, deviceId, action, source });
    }, this.ackTimeoutMs));

    return {
      commandId,
      deviceId,
      action,
      source,
      status: 'PENDING',
      deviceName: device.name ?? null,
    };
  }

  async handleAck({ command_id: commandId, device_id: deviceId, status, execution_time_ms: executionTimeMs, actual_state: actualState }) {
    if (!commandId || !deviceId || !status) {
      throw new DeviceCommandError('ACK must contain command_id, device_id, and status');
    }

    const timer = this.pendingTimers.get(commandId);
    if (timer) this.clearTimer(timer);
    this.pendingTimers.delete(commandId);

    const command = await this.devices.getCommandById(commandId);
    if (!command || command.status !== 'PENDING') return undefined;

    const normalizedStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    const updated = await this.devices.updateCommandResult(commandId, {
      status: normalizedStatus,
      executionTimeMs: executionTimeMs ?? null,
    });
    if (!updated) return undefined;

    if (normalizedStatus === 'SUCCESS' && actualState) {
      await this.devices.updateActualState(deviceId, actualState);
    }

    await this.#publishCommandUpdate({
      roomId: this.roomId,
      commandId,
      deviceId,
      action: command.action,
      source: command.source,
      status: normalizedStatus,
      executionTimeMs: executionTimeMs ?? null,
      actualState: normalizedStatus === 'SUCCESS' ? actualState : null,
    });
    return { commandId, status: normalizedStatus };
  }

  async #handleTimeout({ commandId, roomId, deviceId, action, source }) {
    this.pendingTimers.delete(commandId);
    const updated = await this.devices.updateCommandTimeout(commandId);
    if (!updated) return;
    await this.#publishCommandUpdate({ roomId, commandId, deviceId, action, source, status: 'TIMEOUT' });
  }

  async #finish(commandId, { roomId, deviceId, action, source, status, reason = null }) {
    await this.devices.updateCommandResult(commandId, { status, executionTimeMs: null });
    await this.#publishCommandUpdate({ roomId, commandId, deviceId, action, source, status, reason });
  }

  async #publishCommandUpdate({ roomId, commandId, deviceId, action, source, status, executionTimeMs = null, actualState = null, reason = null }) {
    const payload = {
      command_id: commandId,
      device_id: deviceId,
      action,
      source,
      status,
      execution_time_ms: executionTimeMs,
      actual_state: actualState,
      reason,
    };
    const realtime = this.app.get('realtime');
    realtime?.publishToRoom(roomId, { event: 'device:command-update', data: payload });
    if (actualState) {
      realtime?.publishToRoom(roomId, {
        event: 'device:status',
        data: { device_id: deviceId, actual_state: actualState },
      });
    }

    const automationService = this.app.get('automationService');
    await automationService?.handleDeviceCommandResult({
      roomId,
      commandId,
      deviceId,
      action,
      source,
      status,
      executionTimeMs,
    });
  }
}

module.exports = { DeviceCommandService, DeviceCommandError };
