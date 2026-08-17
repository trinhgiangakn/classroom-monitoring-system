const { ALERT_STATUS } = require('./alert.constants');

/**
 * Repository contract: create(input), findById(id), save(alert), list(roomId).
 * DEV 1 will later replace the repository with a MySQL implementation.
 */
class AlertService {
  constructor(repository) {
    this.repository = repository;
  }

  create(input) {
    return this.repository.create(input);
  }

  async acknowledge(id, actorId, now = new Date()) {
    const alert = await this.#requireAlert(id);
    if (alert.status === ALERT_STATUS.RESOLVED) return alert;
    return this.repository.save({ ...alert, status: ALERT_STATUS.ACKNOWLEDGED, acknowledgedBy: actorId, acknowledgedAt: now });
  }

  async resolve(id, actorId, now = new Date()) {
    const alert = await this.#requireAlert(id);
    return this.repository.save({ ...alert, status: ALERT_STATUS.RESOLVED, resolvedBy: actorId, resolvedAt: now });
  }

  async summary(roomId) {
    const alerts = await this.repository.list(roomId);
    return alerts.reduce((result, alert) => {
      const key = `${alert.severity}_${alert.status}`;
      result[key] = (result[key] ?? 0) + 1;
      return result;
    }, {});
  }

  async #requireAlert(id) {
    const alert = await this.repository.findById(id);
    if (!alert) throw new Error(`Alert ${id} was not found`);
    return alert;
  }
}

module.exports = { AlertService };
