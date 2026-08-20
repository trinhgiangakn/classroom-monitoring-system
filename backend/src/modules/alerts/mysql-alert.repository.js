const { ALERT_STATUS } = require('./alert.constants');

function mapAlert(row) {
  if (!row) return null;
  let metadata = row.metadata ?? null;
  if (typeof metadata === 'string') {
    try {
      metadata = JSON.parse(metadata);
    } catch {
      metadata = { raw: metadata };
    }
  }
  return {
    id: String(row.alert_id),
    roomId: row.room_code || 'P.101',
    type: row.alert_type,
    severity: row.severity,
    source: row.source || row.alert_type,
    conditionKey: row.condition_key ?? null,
    message: row.message,
    status: row.status,
    metadata,
    createdAt: row.created_at,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
  };
}

/** MySQL adapter for the DEV 4 AlertService repository contract. */
class MySqlAlertRepository {
  constructor(database) {
    this.database = database;
  }

  async create({ roomId = 'P.101', type = null, severity, source, conditionKey = null, message, metadata = null }) {
    const [result] = await this.database.query(
      `INSERT INTO alerts (room_code, alert_type, source, condition_key, message, severity, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, type || source, source, conditionKey, message, severity, ALERT_STATUS.NEW, metadata ? JSON.stringify(metadata) : null],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await this.database.query(
      'SELECT * FROM alerts WHERE alert_id = ? AND deleted_at IS NULL',
      [id],
    );
    return mapAlert(rows[0]);
  }

  async save(alert) {
    await this.database.query(
      `UPDATE alerts
       SET status = ?,
           is_resolved = ?,
           acknowledged_by = ?, acknowledged_at = ?,
           resolved_by = ?, resolved_at = ?
       WHERE alert_id = ?`,
      [
        alert.status,
        alert.status === ALERT_STATUS.RESOLVED,
        alert.acknowledgedBy ?? null,
        alert.acknowledgedAt ?? null,
        alert.resolvedBy ?? null,
        alert.resolvedAt ?? null,
        alert.id,
      ],
    );
    return this.findById(alert.id);
  }

  async list(filters = {}) {
    const normalized = typeof filters === 'string' ? { roomId: filters } : filters;
    const conditions = ['a.room_code = ?', 'a.deleted_at IS NULL'];
    const parameters = [normalized.roomId || 'P.101'];

    if (normalized.status) {
      conditions.push('a.status = ?');
      parameters.push(normalized.status);
    }
    if (normalized.severity) {
      conditions.push('a.severity = ?');
      parameters.push(normalized.severity);
    }
    if (normalized.userId) {
      const dismissalCondition = `EXISTS (
        SELECT 1 FROM alert_dismissals AS ad
        WHERE ad.alert_id = a.alert_id AND ad.user_id = ?
      )`;
      conditions.push(normalized.visibility === 'dismissed'
        ? dismissalCondition
        : `NOT ${dismissalCondition}`);
      parameters.push(normalized.userId);
    } else if (normalized.visibility === 'dismissed') {
      conditions.push('1 = 0');
    }

    const limit = Math.min(Math.max(Number(normalized.limit) || 100, 1), 500);
    parameters.push(limit);
    const [rows] = await this.database.query(
      `SELECT a.* FROM alerts AS a
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.created_at DESC
       LIMIT ?`,
      parameters,
    );
    return rows.map(mapAlert);
  }

  async findOpenByCondition(roomId, conditionKey) {
    const [rows] = await this.database.query(
      `SELECT * FROM alerts
       WHERE room_code = ? AND condition_key = ? AND status <> ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [roomId, conditionKey, ALERT_STATUS.RESOLVED],
    );
    return mapAlert(rows[0]);
  }

  async restoreDismissal(id, userId) {
    const [result] = await this.database.query(
      'DELETE FROM alert_dismissals WHERE alert_id = ? AND user_id = ?',
      [id, userId],
    );
    return result.affectedRows > 0;
  }

  async dismissResolved(roomId, userId) {
    const [result] = await this.database.query(
      `INSERT IGNORE INTO alert_dismissals (alert_id, user_id)
       SELECT a.alert_id, ?
       FROM alerts AS a
       WHERE a.room_code = ?
         AND a.status = ?
         AND a.deleted_at IS NULL`,
      [userId, roomId, ALERT_STATUS.RESOLVED],
    );
    return result.affectedRows;
  }

  async softDelete(id, actorId) {
    const [result] = await this.database.query(
      `UPDATE alerts
       SET deleted_at = CURRENT_TIMESTAMP(3), deleted_by = ?
       WHERE alert_id = ? AND status = ? AND deleted_at IS NULL`,
      [actorId, id, ALERT_STATUS.RESOLVED],
    );
    return result.affectedRows > 0;
  }
}

module.exports = { MySqlAlertRepository };
