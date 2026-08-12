const {
  HANOI_WEATHER,
  WEATHER_REFRESH_INTERVAL_MS,
} = require('./weather.constants');

/** Refreshes Hanoi weather on a timer and keeps failures isolated from the backend. */
class WeatherSyncJob {
  constructor({
    weatherContext,
    publish = async () => {},
    logger = console,
    roomId = HANOI_WEATHER.roomId,
    intervalMs = WEATHER_REFRESH_INTERVAL_MS,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval,
  }) {
    this.weatherContext = weatherContext;
    this.publish = publish;
    this.logger = logger;
    this.roomId = roomId;
    this.intervalMs = intervalMs;
    this.setIntervalImpl = setIntervalImpl;
    this.clearIntervalImpl = clearIntervalImpl;
    this.timer = null;
  }

  async runOnce() {
    try {
      const snapshot = await this.weatherContext.refresh(this.roomId);
      await this.publish(snapshot);
      return snapshot;
    } catch (error) {
      this.logger.error?.('Weather sync failed', { message: error.message });
      return null;
    }
  }

  start() {
    if (this.timer) return;
    void this.runOnce();
    this.timer = this.setIntervalImpl(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (!this.timer) return;
    this.clearIntervalImpl(this.timer);
    this.timer = null;
  }
}

module.exports = { WeatherSyncJob };
