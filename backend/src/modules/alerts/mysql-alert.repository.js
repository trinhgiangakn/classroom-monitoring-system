const { ALERT_STATUS } = require('./alert.constants');

function mapAlert(row) {
  if (!row) return null;

  // mysql2 automatically parses JSON columns into objects.
  // Guard against legacy string rows or unexpected types just in case.
  let metadata = null;
  if (row.metadata !== null && row.metadata !== undefined) {
    if (typeof row.metadata === 'string') {
      try { metadata = JSON.parse(row.metadata); } catch { metadata = null; }
    } else {
      metadata = row.metadata; // already an Object — do NOT call JSON.parse again
    }
  }

  return {
    id: String(row.alert_id),
    roomId: row.room_code,
    severity: row.severity,
    source: row.source,
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

  async create({ roomId = 'P.101', severity, source, message, metadata = null }) {
    const [result] = await this.database.query(
      `INSERT INTO alerts (room_code, alert_type, source, message, severity, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomId, source, source, message, severity, ALERT_STATUS.NEW, metadata ? JSON.stringify(metadata) : null],
    );
    return this.findById(result.insertId);
  }

  async findById(id) {
    const [rows] = await this.database.query('SELECT * FROM alerts WHERE alert_id = ?', [id]);
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

  async list(roomId = 'P.101') {
    const [rows] = await this.database.query(
      'SELECT * FROM alerts WHERE room_code = ? ORDER BY created_at DESC',
      [roomId],
    );
    return rows.map(mapAlert);
  }
}

module.exports = { MySqlAlertRepository };
