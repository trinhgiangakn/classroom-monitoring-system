function parseJson(value, fieldName) {
  if (value === null || value === undefined) return {};
  try {
    return JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : value);
  } catch {
    throw new Error(`automation_rules.${fieldName} must contain valid JSON`);
  }
}

function mapRule(row) {
  const conditions = parseJson(row.conditions, 'conditions');
  const actions = parseJson(row.actions, 'actions');
  const activation = conditions.activation;
  const deactivation = conditions.deactivation;
  const deviceId = row.device_id ?? actions.device_id;
  if (!conditions.sensor || !activation || !deactivation || !deviceId) {
    throw new Error(`Automation rule ${row.rule_id} has incomplete configuration`);
  }

  return {
    id: String(row.rule_id),
    roomId: row.room_code,
    deviceId,
    enabled: Boolean(row.is_enabled),
    sensor: conditions.sensor,
    activation: { ...activation, action: activation.action ?? actions.activate },
    deactivation: { ...deactivation, action: deactivation.action ?? actions.deactivate },
    delayMs: Number(conditions.delay_ms ?? 10_000),
    minValidNodes: Number(row.min_valid_nodes ?? 2),
    weatherAdvisory: conditions.weather_advisory ?? null,
  };
}

/** Read-only MySQL adapter used by the DEV 4 automation runtime. */
class MySqlAutomationRepository {
  constructor(database) {
    this.database = database;
  }

  async listEnabledRules(roomId) {
    const [rows] = await this.database.query(
      `SELECT rule_id, room_code, device_id, conditions, actions, is_enabled, min_valid_nodes
       FROM automation_rules
       WHERE room_code = ? AND is_enabled = TRUE`,
      [roomId],
    );
    return rows.map(mapRule);
  }

  async getRuntimeContext(roomId) {
    const [[device]] = await this.database.query(
      'SELECT operation_mode FROM devices ORDER BY device_id LIMIT 1',
    );
    const [[snapshot]] = await this.database.query(
      'SELECT valid_node_count FROM v_room_environment_snapshot WHERE room_code = ?',
      [roomId],
    );
    return {
      operationMode: device?.operation_mode ?? 'MANUAL',
      validNodeCount: Number(snapshot?.valid_node_count ?? 0),
    };
  }
}

module.exports = { MySqlAutomationRepository, mapRule };
