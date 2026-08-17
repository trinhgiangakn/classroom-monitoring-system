-- Dev 2 - IoT data schema for MySQL 8.0+
-- Prerequisite: the shared/core migration has already created the
-- classroom_monitoring database and rooms table. All timestamps use UTC.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

USE classroom_monitoring;

CREATE TABLE IF NOT EXISTS gateways (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  gateway_code VARCHAR(50) NOT NULL,
  gateway_name VARCHAR(120) NOT NULL,
  mac_address VARCHAR(17) NULL,
  firmware_version VARCHAR(50) NULL,
  gateway_status ENUM('ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  wifi_connected BOOLEAN NOT NULL DEFAULT FALSE,
  mqtt_connected BOOLEAN NOT NULL DEFAULT FALSE,
  wifi_rssi SMALLINT NULL,
  ip_address VARCHAR(45) NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateways_gateway_code (gateway_code),
  UNIQUE KEY uq_gateways_mac_address (mac_address),
  KEY idx_gateways_room_status (room_id, gateway_status),
  KEY idx_gateways_last_seen (last_seen_at),
  CONSTRAINT fk_gateways_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_gateways_wifi_rssi
    CHECK (wifi_rssi IS NULL OR wifi_rssi BETWEEN -127 AND 20)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS gateway_metrics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  gateway_id BIGINT UNSIGNED NOT NULL,
  cpu_usage_percent DECIMAL(5,2) NULL,
  memory_usage_percent DECIMAL(5,2) NULL,
  mqtt_queue_percent DECIMAL(5,2) NULL,
  wifi_rssi SMALLINT NULL,
  wifi_connected BOOLEAN NOT NULL,
  mqtt_connected BOOLEAN NOT NULL,
  uptime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  recorded_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_gateway_metrics_sample (gateway_id, recorded_at),
  KEY idx_gateway_metrics_gateway_time (gateway_id, recorded_at),
  CONSTRAINT fk_gateway_metrics_gateway
    FOREIGN KEY (gateway_id) REFERENCES gateways (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_gateway_metrics_values
    CHECK (
      (cpu_usage_percent IS NULL OR cpu_usage_percent BETWEEN 0 AND 100)
      AND (memory_usage_percent IS NULL OR memory_usage_percent BETWEEN 0 AND 100)
      AND (mqtt_queue_percent IS NULL OR mqtt_queue_percent BETWEEN 0 AND 100)
      AND (wifi_rssi IS NULL OR wifi_rssi BETWEEN -127 AND 20)
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sensor_nodes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  gateway_id BIGINT UNSIGNED NOT NULL,
  node_code VARCHAR(50) NOT NULL,
  node_name VARCHAR(120) NOT NULL,
  mac_address VARCHAR(17) NOT NULL,
  position_code ENUM('NW', 'NE', 'SW', 'SE', 'OTHER') NOT NULL,
  location_label VARCHAR(120) NOT NULL,
  firmware_version VARCHAR(50) NULL,
  node_status ENUM('ONLINE', 'WEAK_SIGNAL', 'OFFLINE', 'ERROR', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  sensor_health ENUM('OK', 'DEGRADED', 'ERROR', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  battery_percent DECIMAL(5,2) NULL,
  signal_rssi SMALLINT NULL,
  packet_success_rate DECIMAL(5,2) NULL,
  last_seen_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sensor_nodes_node_code (node_code),
  UNIQUE KEY uq_sensor_nodes_mac_address (mac_address),
  UNIQUE KEY uq_sensor_nodes_room_position (room_id, position_code),
  KEY idx_sensor_nodes_gateway_status (gateway_id, node_status),
  KEY idx_sensor_nodes_room_last_seen (room_id, last_seen_at),
  CONSTRAINT fk_sensor_nodes_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sensor_nodes_gateway
    FOREIGN KEY (gateway_id) REFERENCES gateways (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sensor_nodes_percentages
    CHECK (
      (battery_percent IS NULL OR battery_percent BETWEEN 0 AND 100)
      AND (packet_success_rate IS NULL OR packet_success_rate BETWEEN 0 AND 100)
    ),
  CONSTRAINT chk_sensor_nodes_rssi
    CHECK (signal_rssi IS NULL OR signal_rssi BETWEEN -127 AND 20)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sensor_data (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  node_id BIGINT UNSIGNED NOT NULL,
  gateway_id BIGINT UNSIGNED NOT NULL,
  ingest_key VARCHAR(100) NOT NULL COMMENT 'Stable idempotency key used to discard MQTT QoS 1 duplicates',
  temperature_c DECIMAL(6,3) NULL,
  humidity_percent DECIMAL(6,3) NULL,
  pressure_hpa DECIMAL(8,3) NULL,
  light_lux DECIMAL(12,3) NULL,
  air_quality_ppm DECIMAL(12,3) NULL,
  air_quality_status ENUM('GOOD', 'NORMAL', 'POOR', 'HAZARDOUS', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  data_status ENUM('VALID', 'PARTIAL', 'INVALID') NOT NULL DEFAULT 'VALID',
  error_flags JSON NULL,
  ble_rssi SMALLINT NULL,
  sampled_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sensor_data_ingest_key (ingest_key),
  KEY idx_sensor_data_node_time (node_id, sampled_at),
  KEY idx_sensor_data_gateway_time (gateway_id, received_at),
  KEY idx_sensor_data_status_time (data_status, sampled_at),
  CONSTRAINT fk_sensor_data_node
    FOREIGN KEY (node_id) REFERENCES sensor_nodes (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sensor_data_gateway
    FOREIGN KEY (gateway_id) REFERENCES gateways (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sensor_data_ranges
    CHECK (
      (temperature_c IS NULL OR temperature_c BETWEEN -40 AND 85)
      AND (humidity_percent IS NULL OR humidity_percent BETWEEN 0 AND 100)
      AND (pressure_hpa IS NULL OR pressure_hpa BETWEEN 300 AND 1200)
      AND (light_lux IS NULL OR light_lux >= 0)
      AND (air_quality_ppm IS NULL OR air_quality_ppm >= 0)
      AND (ble_rssi IS NULL OR ble_rssi BETWEEN -127 AND 20)
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sensor_data_hourly (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  node_id BIGINT UNSIGNED NOT NULL,
  bucket_start DATETIME NOT NULL,
  sample_count INT UNSIGNED NOT NULL,
  avg_temperature_c DECIMAL(8,3) NULL,
  min_temperature_c DECIMAL(8,3) NULL,
  max_temperature_c DECIMAL(8,3) NULL,
  avg_humidity_percent DECIMAL(8,3) NULL,
  min_humidity_percent DECIMAL(8,3) NULL,
  max_humidity_percent DECIMAL(8,3) NULL,
  avg_pressure_hpa DECIMAL(10,3) NULL,
  min_pressure_hpa DECIMAL(10,3) NULL,
  max_pressure_hpa DECIMAL(10,3) NULL,
  avg_light_lux DECIMAL(14,3) NULL,
  min_light_lux DECIMAL(14,3) NULL,
  max_light_lux DECIMAL(14,3) NULL,
  avg_air_quality_ppm DECIMAL(14,3) NULL,
  min_air_quality_ppm DECIMAL(14,3) NULL,
  max_air_quality_ppm DECIMAL(14,3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sensor_data_hourly_node_bucket (node_id, bucket_start),
  KEY idx_sensor_data_hourly_bucket (bucket_start),
  CONSTRAINT fk_sensor_data_hourly_node
    FOREIGN KEY (node_id) REFERENCES sensor_nodes (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sensor_data_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  node_id BIGINT UNSIGNED NOT NULL,
  bucket_date DATE NOT NULL,
  sample_count INT UNSIGNED NOT NULL,
  avg_temperature_c DECIMAL(8,3) NULL,
  min_temperature_c DECIMAL(8,3) NULL,
  max_temperature_c DECIMAL(8,3) NULL,
  avg_humidity_percent DECIMAL(8,3) NULL,
  min_humidity_percent DECIMAL(8,3) NULL,
  max_humidity_percent DECIMAL(8,3) NULL,
  avg_pressure_hpa DECIMAL(10,3) NULL,
  min_pressure_hpa DECIMAL(10,3) NULL,
  max_pressure_hpa DECIMAL(10,3) NULL,
  avg_light_lux DECIMAL(14,3) NULL,
  min_light_lux DECIMAL(14,3) NULL,
  max_light_lux DECIMAL(14,3) NULL,
  avg_air_quality_ppm DECIMAL(14,3) NULL,
  min_air_quality_ppm DECIMAL(14,3) NULL,
  max_air_quality_ppm DECIMAL(14,3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_sensor_data_daily_node_bucket (node_id, bucket_date),
  KEY idx_sensor_data_daily_bucket (bucket_date),
  CONSTRAINT fk_sensor_data_daily_node
    FOREIGN KEY (node_id) REFERENCES sensor_nodes (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE OR REPLACE VIEW v_latest_sensor_data AS
SELECT
  ranked.id,
  ranked.node_id,
  ranked.gateway_id,
  ranked.temperature_c,
  ranked.humidity_percent,
  ranked.pressure_hpa,
  ranked.light_lux,
  ranked.air_quality_ppm,
  ranked.air_quality_status,
  ranked.data_status,
  ranked.error_flags,
  ranked.ble_rssi,
  ranked.sampled_at,
  ranked.received_at
FROM (
  SELECT
    sd.*,
    ROW_NUMBER() OVER (
      PARTITION BY sd.node_id
      ORDER BY sd.sampled_at DESC, sd.id DESC
    ) AS row_number_for_node
  FROM sensor_data AS sd
) AS ranked
WHERE ranked.row_number_for_node = 1;

CREATE OR REPLACE VIEW v_room_environment_snapshot AS
SELECT
  r.id AS room_id,
  r.room_code,
  COUNT(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN 1 END) AS valid_node_count,
  ROUND(AVG(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN lsd.temperature_c END), 2) AS avg_temperature_c,
  ROUND(AVG(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN lsd.humidity_percent END), 2) AS avg_humidity_percent,
  ROUND(AVG(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN lsd.pressure_hpa END), 2) AS avg_pressure_hpa,
  ROUND(AVG(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN lsd.light_lux END), 2) AS avg_light_lux,
  ROUND(AVG(CASE WHEN lsd.data_status = 'VALID' AND sn.node_status <> 'OFFLINE' THEN lsd.air_quality_ppm END), 2) AS avg_air_quality_ppm,
  MAX(lsd.sampled_at) AS latest_sampled_at
FROM rooms AS r
LEFT JOIN sensor_nodes AS sn ON sn.room_id = r.id
LEFT JOIN v_latest_sensor_data AS lsd ON lsd.node_id = sn.id
GROUP BY r.id, r.room_code;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_rollup_sensor_data_hourly$$
CREATE PROCEDURE sp_rollup_sensor_data_hourly(
  IN p_from DATETIME,
  IN p_to DATETIME
)
SQL SECURITY INVOKER
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid hourly rollup range';
  END IF;

  INSERT INTO sensor_data_hourly (
    node_id,
    bucket_start,
    sample_count,
    avg_temperature_c,
    min_temperature_c,
    max_temperature_c,
    avg_humidity_percent,
    min_humidity_percent,
    max_humidity_percent,
    avg_pressure_hpa,
    min_pressure_hpa,
    max_pressure_hpa,
    avg_light_lux,
    min_light_lux,
    max_light_lux,
    avg_air_quality_ppm,
    min_air_quality_ppm,
    max_air_quality_ppm
  )
  SELECT
    node_id,
    TIMESTAMP(DATE_FORMAT(sampled_at, '%Y-%m-%d %H:00:00')),
    COUNT(*),
    AVG(temperature_c), MIN(temperature_c), MAX(temperature_c),
    AVG(humidity_percent), MIN(humidity_percent), MAX(humidity_percent),
    AVG(pressure_hpa), MIN(pressure_hpa), MAX(pressure_hpa),
    AVG(light_lux), MIN(light_lux), MAX(light_lux),
    AVG(air_quality_ppm), MIN(air_quality_ppm), MAX(air_quality_ppm)
  FROM sensor_data
  WHERE data_status = 'VALID'
    AND sampled_at >= p_from
    AND sampled_at < p_to
  GROUP BY node_id, TIMESTAMP(DATE_FORMAT(sampled_at, '%Y-%m-%d %H:00:00'))
  ON DUPLICATE KEY UPDATE
    sample_count = VALUES(sample_count),
    avg_temperature_c = VALUES(avg_temperature_c),
    min_temperature_c = VALUES(min_temperature_c),
    max_temperature_c = VALUES(max_temperature_c),
    avg_humidity_percent = VALUES(avg_humidity_percent),
    min_humidity_percent = VALUES(min_humidity_percent),
    max_humidity_percent = VALUES(max_humidity_percent),
    avg_pressure_hpa = VALUES(avg_pressure_hpa),
    min_pressure_hpa = VALUES(min_pressure_hpa),
    max_pressure_hpa = VALUES(max_pressure_hpa),
    avg_light_lux = VALUES(avg_light_lux),
    min_light_lux = VALUES(min_light_lux),
    max_light_lux = VALUES(max_light_lux),
    avg_air_quality_ppm = VALUES(avg_air_quality_ppm),
    min_air_quality_ppm = VALUES(min_air_quality_ppm),
    max_air_quality_ppm = VALUES(max_air_quality_ppm);
END$$

DROP PROCEDURE IF EXISTS sp_rollup_sensor_data_daily$$
CREATE PROCEDURE sp_rollup_sensor_data_daily(
  IN p_from DATE,
  IN p_to DATE
)
SQL SECURITY INVOKER
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from >= p_to THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid daily rollup range';
  END IF;

  INSERT INTO sensor_data_daily (
    node_id,
    bucket_date,
    sample_count,
    avg_temperature_c,
    min_temperature_c,
    max_temperature_c,
    avg_humidity_percent,
    min_humidity_percent,
    max_humidity_percent,
    avg_pressure_hpa,
    min_pressure_hpa,
    max_pressure_hpa,
    avg_light_lux,
    min_light_lux,
    max_light_lux,
    avg_air_quality_ppm,
    min_air_quality_ppm,
    max_air_quality_ppm
  )
  SELECT
    node_id,
    DATE(sampled_at),
    COUNT(*),
    AVG(temperature_c), MIN(temperature_c), MAX(temperature_c),
    AVG(humidity_percent), MIN(humidity_percent), MAX(humidity_percent),
    AVG(pressure_hpa), MIN(pressure_hpa), MAX(pressure_hpa),
    AVG(light_lux), MIN(light_lux), MAX(light_lux),
    AVG(air_quality_ppm), MIN(air_quality_ppm), MAX(air_quality_ppm)
  FROM sensor_data
  WHERE data_status = 'VALID'
    AND sampled_at >= p_from
    AND sampled_at < p_to
  GROUP BY node_id, DATE(sampled_at)
  ON DUPLICATE KEY UPDATE
    sample_count = VALUES(sample_count),
    avg_temperature_c = VALUES(avg_temperature_c),
    min_temperature_c = VALUES(min_temperature_c),
    max_temperature_c = VALUES(max_temperature_c),
    avg_humidity_percent = VALUES(avg_humidity_percent),
    min_humidity_percent = VALUES(min_humidity_percent),
    max_humidity_percent = VALUES(max_humidity_percent),
    avg_pressure_hpa = VALUES(avg_pressure_hpa),
    min_pressure_hpa = VALUES(min_pressure_hpa),
    max_pressure_hpa = VALUES(max_pressure_hpa),
    avg_light_lux = VALUES(avg_light_lux),
    min_light_lux = VALUES(min_light_lux),
    max_light_lux = VALUES(max_light_lux),
    avg_air_quality_ppm = VALUES(avg_air_quality_ppm),
    min_air_quality_ppm = VALUES(min_air_quality_ppm),
    max_air_quality_ppm = VALUES(max_air_quality_ppm);
END$$

DROP PROCEDURE IF EXISTS sp_purge_expired_sensor_data$$
CREATE PROCEDURE sp_purge_expired_sensor_data(IN p_retention_days INT UNSIGNED)
SQL SECURITY INVOKER
BEGIN
  IF p_retention_days IS NULL OR p_retention_days < 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Retention days must be positive';
  END IF;

  DELETE FROM sensor_data
  WHERE sampled_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL p_retention_days DAY);
END$$

DELIMITER ;
