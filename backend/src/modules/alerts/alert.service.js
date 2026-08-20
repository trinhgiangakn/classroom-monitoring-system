const { ALERT_STATUS } = require('./alert.constants');

class AlertNotFoundError extends Error {
  constructor(id) {
    super(`Alert ${id} was not found`);
    this.name = 'AlertNotFoundError';
    this.statusCode = 404;
  }
}

class AlertConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlertConflictError';
    this.statusCode = 409;
  }
}

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

  list(filters = {}) {
    return this.repository.list(filters);
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

  async summary(filters = {}) {
    const alerts = await this.repository.list(filters);
    return alerts.reduce((result, alert) => {
      const severity = alert.severity.toLowerCase();
      result[severity] += 1;
      result.total += 1;
      if (alert.status === ALERT_STATUS.RESOLVED) result.resolved += 1;
      else result.unresolved += 1;
      return result;
    }, { critical: 0, warning: 0, resolved: 0, unresolved: 0, total: 0 });
  }

  async restoreDismissal(id, actorId) {
    const alert = await this.#requireAlert(id);
    await this.repository.restoreDismissal(id, actorId);
    return alert;
  }

  dismissResolved(roomId, actorId) {
    return this.repository.dismissResolved(roomId, actorId);
  }

  async remove(id, actorId) {
    const alert = await this.#requireAlert(id);
    if (alert.status !== ALERT_STATUS.RESOLVED) {
      throw new AlertConflictError('Chỉ có thể xóa cảnh báo đã xử lý');
    }
    const removed = await this.repository.softDelete(id, actorId);
    if (!removed) throw new AlertNotFoundError(id);
    return alert;
  }

  /**
   * Keeps one open alert per physical condition. The evaluator receives the
   * current open alert and returns the desired alert payload, or null when the
   * condition has recovered. Severity/type transitions resolve the old alert
   * before opening the replacement.
   */
  async evaluateCondition({ roomId = 'P.101', conditionKey, evaluate, now = new Date() }) {
    if (!conditionKey) throw new TypeError('conditionKey is required');
    if (typeof evaluate !== 'function') throw new TypeError('condition evaluator is required');
    const current = await this.repository.findOpenByCondition(roomId, conditionKey);
    const next = evaluate(current);

    if (!next) {
      if (!current) return { created: null, resolved: null, current: null };
      const resolved = await this.repository.save({
        ...current,
        status: ALERT_STATUS.RESOLVED,
        resolvedBy: null,
        resolvedAt: now,
      });
      return { created: null, resolved, current: null };
    }

    if (current && current.type === next.type && current.severity === next.severity) {
      return { created: null, resolved: null, current };
    }

    const resolved = current
      ? await this.repository.save({
          ...current,
          status: ALERT_STATUS.RESOLVED,
          resolvedBy: null,
          resolvedAt: now,
        })
      : null;
    const created = await this.repository.create({
      ...next,
      roomId,
      conditionKey,
    });
    return { created, resolved, current: created };
  }

  async #requireAlert(id) {
    const alert = await this.repository.findById(id);
    if (!alert) throw new AlertNotFoundError(id);
    return alert;
  }
}

module.exports = { AlertConflictError, AlertNotFoundError, AlertService };
