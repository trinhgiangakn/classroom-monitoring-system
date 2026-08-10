-- Dev 2 query templates: MQTT ingestion, telemetry REST APIs and live events.
-- Parameters use :name syntax (mysql2 with namedPlaceholders: true).

USE classroom_monitoring;

-- ---------------------------------------------------------------------------
-- MQTT: classroom/{room_id}/sensor/{node_id}/telemetry (QoS 1)
-- Run the insert and node update in one transaction. A duplicate ingest_key is
-- a successful no-op so MQTT redelivery never creates a second sample.
-- ---------------------------------------------------------------------------
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
)
SELECT
  sn.id,
  g.id,
  :ingest_key,
  :temperature_c,
  :humidity_percent,
  :pressure_hpa,
  :light_lux,
  :air_quality_ppm,
  :air_quality_status,
  :data_status,
  :error_flags,
  :ble_rssi,
  :sampled_at,
  UTC_TIMESTAMP(3)
FROM sensor_nodes AS sn
JOIN gateways AS g ON g.id = sn.gateway_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND sn.node_code = :node_code
  AND g.gateway_code = :gateway_code
ON DUPLICATE KEY UPDATE
  id = LAST_INSERT_ID(id);

UPDATE sensor_nodes AS sn
JOIN rooms AS r ON r.id = sn.room_id
SET
  sn.node_status = :node_status,
  sn.sensor_health = :sensor_health,
  sn.signal_rssi = :ble_rssi,
  sn.last_seen_at = :sampled_at
WHERE r.room_code = :room_code
  AND sn.node_code = :node_code;

-- MQTT: classroom/{room_id}/sensor/{node_id}/status
UPDATE sensor_nodes AS sn
JOIN rooms AS r ON r.id = sn.room_id
SET
  sn.node_status = :node_status,
  sn.sensor_health = :sensor_health,
  sn.signal_rssi = :signal_rssi,
  sn.packet_success_rate = :packet_success_rate,
  sn.battery_percent = :battery_percent,
  sn.last_seen_at = :last_seen_at
WHERE r.room_code = :room_code
  AND sn.node_code = :node_code;

-- MQTT: classroom/{room_id}/gateway/status
UPDATE gateways AS g
JOIN rooms AS r ON r.id = g.room_id
SET
  g.gateway_status = :gateway_status,
  g.wifi_connected = :wifi_connected,
  g.mqtt_connected = :mqtt_connected,
  g.wifi_rssi = :wifi_rssi,
  g.ip_address = :ip_address,
  g.firmware_version = COALESCE(:firmware_version, g.firmware_version),
  g.last_seen_at = :last_seen_at
WHERE r.room_code = :room_code
  AND g.gateway_code = :gateway_code;

-- MQTT: classroom/{room_id}/gateway/metrics
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
)
SELECT
  g.id,
  :cpu_usage_percent,
  :memory_usage_percent,
  :mqtt_queue_percent,
  :wifi_rssi,
  :wifi_connected,
  :mqtt_connected,
  :uptime_seconds,
  :recorded_at,
  UTC_TIMESTAMP(3)
FROM gateways AS g
JOIN rooms AS r ON r.id = g.room_id
WHERE r.room_code = :room_code
  AND g.gateway_code = :gateway_code
ON DUPLICATE KEY UPDATE
  cpu_usage_percent = VALUES(cpu_usage_percent),
  memory_usage_percent = VALUES(memory_usage_percent),
  mqtt_queue_percent = VALUES(mqtt_queue_percent),
  wifi_rssi = VALUES(wifi_rssi),
  wifi_connected = VALUES(wifi_connected),
  mqtt_connected = VALUES(mqtt_connected),
  uptime_seconds = VALUES(uptime_seconds),
  received_at = VALUES(received_at);

-- ---------------------------------------------------------------------------
-- GET /api/sensors/latest
-- Returns the latest telemetry for each node, matching the documented API.
-- ---------------------------------------------------------------------------
SELECT
  r.room_code AS room_id,
  sn.node_code AS node_id,
  lsd.temperature_c AS temperature,
  lsd.humidity_percent AS humidity,
  lsd.pressure_hpa AS pressure,
  lsd.light_lux,
  lsd.air_quality_ppm,
  lsd.air_quality_status,
  lsd.data_status AS status,
  lsd.sampled_at AS timestamp
FROM sensor_nodes AS sn
JOIN rooms AS r ON r.id = sn.room_id
LEFT JOIN v_latest_sensor_data AS lsd ON lsd.node_id = sn.id
WHERE r.room_code = :room_code
ORDER BY FIELD(sn.position_code, 'NW', 'NE', 'SW', 'SE', 'OTHER');

-- GET /api/sensors/history for a raw-data time range.
SELECT
  sd.sampled_at AS timestamp,
  sn.node_code AS node_id,
  sd.temperature_c AS temperature,
  sd.humidity_percent AS humidity,
  sd.pressure_hpa AS pressure,
  sd.light_lux,
  sd.air_quality_ppm,
  sd.air_quality_status
FROM sensor_data AS sd
JOIN sensor_nodes AS sn ON sn.id = sd.node_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND sd.data_status = 'VALID'
  AND sd.sampled_at >= :from_time
  AND sd.sampled_at < :to_time
  AND (:node_code IS NULL OR sn.node_code = :node_code)
ORDER BY sd.sampled_at ASC;

-- GET /api/sensors/history using hourly downsampling.
SELECT
  sdh.bucket_start AS timestamp,
  sn.node_code AS node_id,
  sdh.avg_temperature_c AS temperature,
  sdh.avg_humidity_percent AS humidity,
  sdh.avg_pressure_hpa AS pressure,
  sdh.avg_light_lux AS light_lux,
  sdh.avg_air_quality_ppm AS air_quality_ppm,
  sdh.sample_count
FROM sensor_data_hourly AS sdh
JOIN sensor_nodes AS sn ON sn.id = sdh.node_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND sdh.bucket_start >= :from_time
  AND sdh.bucket_start < :to_time
  AND (:node_code IS NULL OR sn.node_code = :node_code)
ORDER BY sdh.bucket_start ASC;

-- GET /api/sensors/history using daily downsampling.
SELECT
  sdd.bucket_date AS date,
  sn.node_code AS node_id,
  sdd.avg_temperature_c AS temperature,
  sdd.avg_humidity_percent AS humidity,
  sdd.avg_pressure_hpa AS pressure,
  sdd.avg_light_lux AS light_lux,
  sdd.avg_air_quality_ppm AS air_quality_ppm,
  sdd.sample_count
FROM sensor_data_daily AS sdd
JOIN sensor_nodes AS sn ON sn.id = sdd.node_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND sdd.bucket_date >= :from_date
  AND sdd.bucket_date < :to_date
  AND (:node_code IS NULL OR sn.node_code = :node_code)
ORDER BY sdd.bucket_date ASC;

-- GET /api/sensors/recent
SELECT
  sd.sampled_at AS timestamp,
  sn.node_code AS node_id,
  sd.temperature_c AS temperature,
  sd.humidity_percent AS humidity,
  sd.pressure_hpa AS pressure,
  sd.light_lux,
  sd.air_quality_ppm,
  sd.air_quality_status,
  sd.data_status AS status,
  sd.error_flags
FROM sensor_data AS sd
JOIN sensor_nodes AS sn ON sn.id = sd.node_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND (:node_code IS NULL OR sn.node_code = :node_code)
  AND sd.sampled_at >= :from_time
  AND sd.sampled_at < :to_time
ORDER BY sd.sampled_at DESC
LIMIT :limit OFFSET :offset;

-- GET /api/sensors/export
-- Stream this result as CSV; do not apply pagination.
SELECT
  sd.sampled_at AS timestamp,
  sn.node_code AS node_id,
  sd.temperature_c AS temperature,
  sd.humidity_percent AS humidity,
  sd.pressure_hpa AS pressure,
  sd.light_lux,
  sd.air_quality_ppm,
  sd.air_quality_status,
  sd.data_status AS status
FROM sensor_data AS sd
JOIN sensor_nodes AS sn ON sn.id = sd.node_id
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
  AND (:node_code IS NULL OR sn.node_code = :node_code)
  AND sd.sampled_at >= :from_time
  AND sd.sampled_at < :to_time
ORDER BY sd.sampled_at ASC;

-- GET /api/nodes
SELECT
  sn.node_code AS node_id,
  sn.node_name,
  sn.position_code,
  sn.location_label AS position,
  sn.node_status AS status,
  sn.sensor_health,
  sn.signal_rssi AS rssi,
  sn.packet_success_rate,
  sn.battery_percent,
  sn.last_seen_at
FROM sensor_nodes AS sn
JOIN rooms AS r ON r.id = sn.room_id
WHERE r.room_code = :room_code
ORDER BY FIELD(sn.position_code, 'NW', 'NE', 'SW', 'SE', 'OTHER');

-- GET /api/nodes/:id
SELECT
  sn.node_code AS node_id,
  sn.node_name,
  sn.mac_address,
  sn.position_code,
  sn.location_label AS position,
  sn.firmware_version,
  sn.node_status AS status,
  sn.sensor_health,
  sn.battery_percent,
  sn.signal_rssi AS rssi,
  sn.packet_success_rate,
  sn.last_seen_at,
  g.gateway_code,
  lsd.temperature_c AS temperature,
  lsd.humidity_percent AS humidity,
  lsd.pressure_hpa AS pressure,
  lsd.light_lux,
  lsd.air_quality_ppm,
  lsd.air_quality_status,
  lsd.data_status,
  lsd.error_flags,
  lsd.sampled_at AS timestamp
FROM sensor_nodes AS sn
JOIN rooms AS r ON r.id = sn.room_id
JOIN gateways AS g ON g.id = sn.gateway_id
LEFT JOIN v_latest_sensor_data AS lsd ON lsd.node_id = sn.id
WHERE r.room_code = :room_code
  AND sn.node_code = :node_code;

-- GET /api/gateway/status
SELECT
  g.gateway_code AS gateway_id,
  g.gateway_name,
  g.gateway_status AS status,
  g.mac_address,
  g.firmware_version,
  g.wifi_connected,
  g.mqtt_connected,
  g.wifi_rssi AS wifi_signal_dbm,
  g.ip_address,
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
WHERE r.room_code = :room_code
  AND (:gateway_code IS NULL OR g.gateway_code = :gateway_code)
ORDER BY g.gateway_code;

-- Aggregation and retention jobs owned by Dev 2.
CALL sp_rollup_sensor_data_hourly(:from_time, :to_time);
CALL sp_rollup_sensor_data_daily(:from_date, :to_date);
CALL sp_purge_expired_sensor_data(90);
