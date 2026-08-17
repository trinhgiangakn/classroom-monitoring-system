export const SQL = Object.freeze({
  resolveNodeForUpdate: `
    SELECT
      sn.id,
      sn.gateway_id,
      sn.node_code,
      sn.node_status,
      sn.sensor_health,
      sn.signal_rssi,
      sn.packet_success_rate,
      sn.battery_percent,
      sn.last_seen_at
    FROM sensor_nodes AS sn
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ? AND sn.node_code = ?
    FOR UPDATE
  `,

  insertTelemetry: `
    INSERT INTO sensor_data (
      node_id,
      gateway_id,
      ingest_key,
      temperature_c,
      humidity_percent,
      pressure_hpa,
      light_lux,
      air_quality_ppm,
      air_quality_status,
      data_status,
      error_flags,
      ble_rssi,
      sampled_at,
      received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
  `,

  updateNodeFromTelemetry: `
    UPDATE sensor_nodes
    SET
      node_status = ?,
      sensor_health = ?,
      signal_rssi = COALESCE(?, signal_rssi),
      last_seen_at = GREATEST(COALESCE(last_seen_at, ?), ?)
    WHERE id = ?
  `,

  updateNodeStatus: `
    UPDATE sensor_nodes
    SET
      node_status = ?,
      sensor_health = ?,
      signal_rssi = COALESCE(?, signal_rssi),
      packet_success_rate = COALESCE(?, packet_success_rate),
      battery_percent = COALESCE(?, battery_percent),
      last_seen_at = GREATEST(COALESCE(last_seen_at, ?), ?)
    WHERE id = ?
  `,

  latestSensors: `
    SELECT
      sn.node_code AS node_id,
      lsd.temperature_c AS temperature,
      lsd.humidity_percent AS humidity,
      lsd.pressure_hpa,
      lsd.light_lux,
      lsd.air_quality_ppm,
      lsd.air_quality_status,
      lsd.data_status AS status,
      lsd.sampled_at AS timestamp
    FROM sensor_nodes AS sn
    JOIN rooms AS r ON r.id = sn.room_id
    LEFT JOIN v_latest_sensor_data AS lsd ON lsd.node_id = sn.id
    WHERE r.room_code = ?
    ORDER BY FIELD(sn.position_code, 'NW', 'NE', 'SW', 'SE', 'OTHER')
  `,

  historyRaw: `
    SELECT
      FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(sd.sampled_at) / 5) * 5) AS timestamp,
      AVG(sd.temperature_c) AS temperature,
      AVG(sd.humidity_percent) AS humidity,
      AVG(sd.pressure_hpa) AS pressure_hpa,
      AVG(sd.light_lux) AS light_lux,
      AVG(sd.air_quality_ppm) AS air_quality_ppm
    FROM sensor_data AS sd
    JOIN sensor_nodes AS sn ON sn.id = sd.node_id
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
      AND sd.data_status = 'VALID'
      AND sd.sampled_at >= ?
      AND sd.sampled_at < ?
      AND (? IS NULL OR sn.node_code = ?)
    GROUP BY FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(sd.sampled_at) / 5) * 5)
    ORDER BY timestamp ASC
  `,

  historyHourly: `
    SELECT
      sdh.bucket_start AS timestamp,
      AVG(sdh.avg_temperature_c) AS temperature,
      AVG(sdh.avg_humidity_percent) AS humidity,
      AVG(sdh.avg_pressure_hpa) AS pressure_hpa,
      AVG(sdh.avg_light_lux) AS light_lux,
      AVG(sdh.avg_air_quality_ppm) AS air_quality_ppm
    FROM sensor_data_hourly AS sdh
    JOIN sensor_nodes AS sn ON sn.id = sdh.node_id
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
      AND sdh.bucket_start >= ?
      AND sdh.bucket_start < ?
      AND (? IS NULL OR sn.node_code = ?)
    GROUP BY sdh.bucket_start
    ORDER BY sdh.bucket_start ASC
  `,

  historyDaily: `
    SELECT
      TIMESTAMP(sdd.bucket_date) AS timestamp,
      AVG(sdd.avg_temperature_c) AS temperature,
      AVG(sdd.avg_humidity_percent) AS humidity,
      AVG(sdd.avg_pressure_hpa) AS pressure_hpa,
      AVG(sdd.avg_light_lux) AS light_lux,
      AVG(sdd.avg_air_quality_ppm) AS air_quality_ppm
    FROM sensor_data_daily AS sdd
    JOIN sensor_nodes AS sn ON sn.id = sdd.node_id
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
      AND sdd.bucket_date >= DATE(?)
      AND sdd.bucket_date < DATE(?)
      AND (? IS NULL OR sn.node_code = ?)
    GROUP BY sdd.bucket_date
    ORDER BY sdd.bucket_date ASC
  `,

  recentSensors: `
    SELECT
      sd.sampled_at AS timestamp,
      sn.node_code AS node_id,
      sd.temperature_c AS temperature,
      sd.humidity_percent AS humidity,
      sd.pressure_hpa,
      sd.light_lux,
      sd.air_quality_ppm,
      sd.air_quality_status,
      sd.data_status AS status
    FROM sensor_data AS sd
    JOIN sensor_nodes AS sn ON sn.id = sd.node_id
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
      AND (? IS NULL OR sn.node_code = ?)
      AND sd.sampled_at >= ?
      AND sd.sampled_at < ?
    ORDER BY sd.sampled_at DESC, sd.id DESC
  `,

  exportSensors: `
    SELECT
      sd.sampled_at AS timestamp,
      sn.node_code AS node_id,
      sd.temperature_c AS temperature,
      sd.humidity_percent AS humidity,
      sd.pressure_hpa,
      sd.light_lux,
      sd.air_quality_ppm,
      sd.air_quality_status,
      sd.data_status AS status
    FROM sensor_data AS sd
    JOIN sensor_nodes AS sn ON sn.id = sd.node_id
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
      AND (? IS NULL OR sn.node_code = ?)
      AND sd.sampled_at >= ?
      AND sd.sampled_at < ?
    ORDER BY sd.sampled_at ASC, sd.id ASC
  `,

  nodes: `
    SELECT
      sn.node_code AS node_id,
      sn.node_status AS status,
      sn.signal_rssi AS rssi,
      sn.packet_success_rate,
      sn.last_seen_at,
      sn.sensor_health,
      sn.location_label AS position
    FROM sensor_nodes AS sn
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE r.room_code = ?
    ORDER BY FIELD(sn.position_code, 'NW', 'NE', 'SW', 'SE', 'OTHER')
  `,

  nodeDetail: `
    SELECT
      sn.node_code AS node_id,
      sn.node_name,
      sn.mac_address,
      sn.location_label AS position,
      sn.firmware_version,
      sn.node_status AS node_status,
      sn.sensor_health,
      sn.battery_percent,
      sn.signal_rssi AS rssi,
      sn.packet_success_rate,
      sn.last_seen_at,
      g.gateway_code AS gateway_id,
      lsd.temperature_c AS temperature,
      lsd.humidity_percent AS humidity,
      lsd.pressure_hpa,
      lsd.light_lux,
      lsd.air_quality_ppm,
      lsd.air_quality_status,
      lsd.data_status AS telemetry_status,
      lsd.sampled_at AS timestamp
    FROM sensor_nodes AS sn
    JOIN rooms AS r ON r.id = sn.room_id
    JOIN gateways AS g ON g.id = sn.gateway_id
    LEFT JOIN v_latest_sensor_data AS lsd ON lsd.node_id = sn.id
    WHERE r.room_code = ? AND sn.node_code = ?
  `,

  resolveGatewayForUpdate: `
    SELECT
      g.id,
      g.gateway_code,
      g.gateway_status,
      g.wifi_connected,
      g.mqtt_connected,
      g.wifi_rssi,
      g.ip_address,
      g.firmware_version,
      g.last_seen_at
    FROM gateways AS g
    JOIN rooms AS r ON r.id = g.room_id
    WHERE r.room_code = ? AND (? IS NULL OR g.gateway_code = ?)
    ORDER BY g.gateway_code
    LIMIT 1
    FOR UPDATE
  `,

  updateGatewayStatus: `
    UPDATE gateways
    SET
      gateway_status = ?,
      wifi_connected = ?,
      mqtt_connected = ?,
      wifi_rssi = ?,
      ip_address = ?,
      firmware_version = COALESCE(?, firmware_version),
      last_seen_at = GREATEST(COALESCE(last_seen_at, ?), ?)
    WHERE id = ?
  `,

  insertGatewayMetrics: `
    INSERT INTO gateway_metrics (
      gateway_id,
      cpu_usage_percent,
      memory_usage_percent,
      mqtt_queue_percent,
      wifi_rssi,
      wifi_connected,
      mqtt_connected,
      uptime_seconds,
      recorded_at,
      received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
  `,

  gatewayStatus: `
    SELECT
      g.gateway_code AS gateway_id,
      IF(g.gateway_status = 'ONLINE' AND g.last_seen_at >= UTC_TIMESTAMP(3) - INTERVAL 60 SECOND, 'ONLINE', 'OFFLINE') AS status,
      IF(g.last_seen_at >= UTC_TIMESTAMP(3) - INTERVAL 60 SECOND, g.wifi_connected, 0) AS wifi_connected,
      IF(g.last_seen_at >= UTC_TIMESTAMP(3) - INTERVAL 60 SECOND, g.mqtt_connected, 0) AS mqtt_connected,
      g.wifi_rssi AS wifi_signal_dbm,
      g.ip_address,
      g.firmware_version,
      g.last_seen_at,
      gm.cpu_usage_percent,
      gm.memory_usage_percent AS ram_heap_percent,
      gm.mqtt_queue_percent,
      gm.uptime_seconds,
      gm.recorded_at AS metrics_recorded_at
    FROM gateways AS g
    JOIN rooms AS r ON r.id = g.room_id
    LEFT JOIN gateway_metrics AS gm
      ON gm.id = (
        SELECT latest.id
        FROM gateway_metrics AS latest
        WHERE latest.gateway_id = g.id
        ORDER BY latest.recorded_at DESC, latest.id DESC
        LIMIT 1
      )
    WHERE r.room_code = ? AND (? IS NULL OR g.gateway_code = ?)
    ORDER BY g.gateway_code
  `,

  staleNodesForUpdate: `
    SELECT
      sn.id,
      r.room_code AS room_id,
      sn.node_code AS node_id,
      sn.signal_rssi AS rssi,
      sn.packet_success_rate,
      sn.last_seen_at,
      sn.sensor_health
    FROM sensor_nodes AS sn
    JOIN rooms AS r ON r.id = sn.room_id
    WHERE sn.node_status <> 'OFFLINE'
      AND sn.last_seen_at IS NOT NULL
      AND sn.last_seen_at < ?
    FOR UPDATE
  `,
})
