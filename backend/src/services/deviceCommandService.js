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
    if (!['MANUAL', 'AUTO', 'SAFE_MODE'].includes(source)) {
      throw new DeviceCommandError('source must be MANUAL, AUTO or SAFE_MODE');
    }

    const device = await this.devices.getDeviceById(deviceId);
    if (!device) throw new DeviceCommandError('Device not found', 404);
    if (source === 'MANUAL' && device.operation_mode !== 'MANUAL') {
      throw new DeviceCommandError('Room is currently in AUTO mode. Switch to MANUAL mode before issuing manual controls.', 403);
    }

    const commandId = `CMD-${randomUUID()}`;
    const actor = requestedBy || (source === 'SAFE_MODE' ? 'safe-mode-engine' : source === 'AUTO' ? 'automation-engine' : 'unknown-user');
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

    if (!published && source === 'MANUAL') {
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

    // In AUTO and SAFE_MODE, update actual states optimistically in database & UI
    if (source === 'AUTO' || source === 'SAFE_MODE') {
      const actionStateMap = { TURN_ON: 'ON', TURN_OFF: 'OFF', OPEN: 'OPENING', CLOSE: 'CLOSING', STOP: 'STOPPED' };
      const optimisticState = actionStateMap[action] ?? 'ON';
      await this.devices.updateCommandResult(commandId, { status: 'SUCCESS', executionTimeMs: 0 });
      await this.devices.updateActualState(deviceId, optimisticState);
      await this.#publishCommandUpdate({
        roomId,
        commandId,
        deviceId,
        action,
        source,
        status: 'SUCCESS',
        executionTimeMs: 0,
        actualState: optimisticState,
      });
      return {
        commandId,
        deviceId,
        action,
        source,
        status: 'SUCCESS',
        actualState: optimisticState,
        deviceName: device.name ?? null,
      };
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

  async handleAck(ackData, topicDeviceId = null) {
    let deviceId = ackData.device_id || topicDeviceId;
    if (deviceId) {
      const aliasMap = {
        LIGHT: 'LIGHT_01',
        FAN: 'FAN_01',
        HUMIDIFIER: 'HUMIDIFIER_01',
        CURTAIN: 'CURTAIN_01',
        RELAY_1: 'LIGHT_01',
        RELAY_2: 'FAN_01',
        RELAY_3: 'HUMIDIFIER_01',
        CURTAIN_MOTOR: 'CURTAIN_01',
      };
      deviceId = aliasMap[deviceId.toUpperCase()] || deviceId;
    }

    let commandId = ackData.command_id;
    let command = null;

    if (commandId) {
      command = await this.devices.getCommandById(commandId);
    } else if (deviceId && typeof this.devices.getLatestPendingCommandForDevice === 'function') {
      command = await this.devices.getLatestPendingCommandForDevice(deviceId);
      if (command) {
        commandId = command.command_id;
      }
    }

    if (!commandId || !command) {
      if (deviceId && ackData.actual_state) {
        await this.devices.updateActualState(deviceId, ackData.actual_state);
        const realtime = this.app.get('realtime');
        realtime?.publishToRoom(this.roomId, {
          event: 'device:status',
          data: { device_id: deviceId, actual_state: ackData.actual_state },
        });
      }
      return undefined;
    }

    const timer = this.pendingTimers.get(commandId);
    if (timer) this.clearTimer(timer);
    this.pendingTimers.delete(commandId);

    const rawStatus = String(ackData.status || 'SUCCESS').toUpperCase();
    const normalizedStatus = rawStatus === 'SUCCESS' || rawStatus === 'OK' ? 'SUCCESS' : 'FAILED';
    const executionTimeMs = ackData.execution_time_ms ?? 50;

    let actualState = ackData.actual_state;
    if (!actualState && normalizedStatus === 'SUCCESS') {
      const actionStateMap = {
        TURN_ON: 'ON',
        TURN_OFF: 'OFF',
        OPEN: 'OPENING',
        CLOSE: 'CLOSING',
        STOP: 'STOPPED',
      };
      actualState = actionStateMap[command.action] ?? 'ON';
    }

    await this.devices.updateCommandResult(commandId, {
      status: normalizedStatus,
      executionTimeMs,
    });

    if (normalizedStatus === 'SUCCESS' && actualState && deviceId) {
      await this.devices.updateActualState(deviceId, actualState);
    }

    await this.#publishCommandUpdate({
      roomId: this.roomId,
      commandId,
      deviceId: deviceId || command.device_id,
      action: command.action,
      source: command.source,
      status: normalizedStatus,
      executionTimeMs,
      actualState: normalizedStatus === 'SUCCESS' ? actualState : null,
    });
    return { commandId, status: normalizedStatus };
  }

  async handleDeviceStatus({ actual_state: actualState }, topicDeviceId = null) {
    if (!actualState || !topicDeviceId) return;
    const aliasMap = {
      LIGHT: 'LIGHT_01',
      FAN: 'FAN_01',
      HUMIDIFIER: 'HUMIDIFIER_01',
      CURTAIN: 'CURTAIN_01',
      RELAY_1: 'LIGHT_01',
      RELAY_2: 'FAN_01',
      RELAY_3: 'HUMIDIFIER_01',
      CURTAIN_MOTOR: 'CURTAIN_01',
    };
    const targetDeviceId = aliasMap[topicDeviceId.toUpperCase()] || topicDeviceId;
    await this.devices.updateActualState(targetDeviceId, actualState);
    const realtime = this.app.get('realtime');
    realtime?.publishToRoom(this.roomId, {
      event: 'device:status',
      data: { device_id: targetDeviceId, actual_state: actualState },
    });
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
