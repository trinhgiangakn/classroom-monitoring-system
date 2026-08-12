import { NODE_OFFLINE_AFTER_SECONDS, RAW_RETENTION_DAYS } from './constants.js'

function startOfHour(date) {
  const value = new Date(date)
  value.setUTCMinutes(0, 0, 0)
  return value
}

function startOfDay(date) {
  const value = new Date(date)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

export class Dev2Jobs {
  constructor({
    repository,
    service,
    publish,
    onNodeStatusesChanged = async () => {},
    logger = console,
    now = () => new Date(),
  }) {
    if (!repository || !service) throw new TypeError('repository and service are required')
    if (typeof publish !== 'function') throw new TypeError('WebSocket publish adapter is required')
    this.repository = repository
    this.service = service
    this.publish = publish
    this.onNodeStatusesChanged = onNodeStatusesChanged
    this.logger = logger
    this.now = now
    this.timers = []
  }

  async runOfflineWatchdog() {
    const cutoff = new Date(this.now().getTime() - NODE_OFFLINE_AFTER_SECONDS * 1000)
    const events = await this.service.markOfflineNodes(cutoff)
    for (const event of events) {
      await this.publish(event.payload, { roomId: event.roomId, nodeId: event.nodeId })
    }
    for (const roomId of new Set(events.map((event) => event.roomId))) {
      if (typeof this.service.nodeStatuses !== 'function') continue
      const statuses = await this.service.nodeStatuses(roomId)
      await this.onNodeStatusesChanged({ roomId, statuses })
    }
  }

  async runHourlyRollup() {
    const to = startOfHour(this.now())
    const from = new Date(to.getTime() - 60 * 60 * 1000)
    await this.repository.rollupHourly(from, to)
  }

  async runDailyRollupAndRetention() {
    const to = startOfDay(this.now())
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    await this.repository.rollupDaily(from, to)
    await this.repository.purgeRawData(RAW_RETENTION_DAYS)
  }

  start() {
    if (this.timers.length > 0) return
    const safely = (name, operation) => async () => {
      try {
        await operation.call(this)
      } catch (error) {
        this.logger.error?.(`Dev 2 job failed: ${name}`, { message: error.message })
      }
    }

    const watchdog = safely('offline-watchdog', this.runOfflineWatchdog)
    const hourly = safely('hourly-rollup', this.runHourlyRollup)
    const daily = safely('daily-rollup-retention', this.runDailyRollupAndRetention)

    void watchdog()
    void hourly()
    void daily()
    this.timers.push(setInterval(watchdog, 5_000))
    this.timers.push(setInterval(hourly, 5 * 60_000))
    this.timers.push(setInterval(daily, 60 * 60_000))
    for (const timer of this.timers) timer.unref?.()
  }

  stop() {
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
  }
}
