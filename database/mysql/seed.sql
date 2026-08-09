-- Dev 2 demo data for room P.101.
-- Prerequisite: the shared rooms table already contains room_code P.101.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';

USE classroom_monitoring;

START TRANSACTION;

SET @room_id = (
  SELECT id
  FROM rooms
  WHERE room_code = 'P.101'
  LIMIT 1
);

INSERT INTO gateways (
  room_id,
  gateway_code,
  gateway_name,
  mac_address,
  firmware_version,
  gateway_status,
  wifi_connected,
  mqtt_connected,
  wifi_rssi,
  ip_address,
  last_seen_at
)
VALUES (
  @room_id,
  'GW-P101-01',
  'ESP32 Gateway P.101',
  '24:6F:28:AA:10:01',
  '1.0.0',
  'ONLINE',
  TRUE,
  TRUE,
  -58,
  '192.168.1.101',
  UTC_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  room_id = VALUES(room_id),
  gateway_name = VALUES(gateway_name),
  firmware_version = VALUES(firmware_version),
  gateway_status = VALUES(gateway_status),
  wifi_connected = VALUES(wifi_connected),
  mqtt_connected = VALUES(mqtt_connected),
  wifi_rssi = VALUES(wifi_rssi),
  ip_address = VALUES(ip_address),
  last_seen_at = VALUES(last_seen_at);

SET @gateway_id = (
  SELECT id
  FROM gateways
  WHERE gateway_code = 'GW-P101-01'
  LIMIT 1
);

INSERT INTO gateway_metrics (
  gateway_id,
  cpu_usage_percent,
  memory_usage_percent,
  mqtt_queue_percent,
  wifi_rssi,
  wifi_connected,
  mqtt_connected,
  uptime_seconds,
  recorded_at
)
SELECT
  @gateway_id,
  34,
  58,
  12,
  -58,
  TRUE,
  TRUE,
  86400,
  UTC_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1
  FROM gateway_metrics AS gm
  WHERE gm.gateway_id = @gateway_id
    AND gm.recorded_at >= UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE
);

INSERT INTO sensor_nodes (
  room_id,
  gateway_id,
  node_code,
  node_name,
  mac_address,
  position_code,
  location_label,
  firmware_version,
  node_status,
  sensor_health,
  signal_rssi,
  packet_success_rate,
  last_seen_at
)
VALUES
  (@room_id, @gateway_id, 'NODE-NW', 'Node Tây Bắc', '00:18:E4:40:00:01', 'NW', 'Góc Tây Bắc', '1.0.0', 'ONLINE', 'OK', -57, 99.40, UTC_TIMESTAMP(3) - INTERVAL 2 SECOND),
  (@room_id, @gateway_id, 'NODE-NE', 'Node Đông Bắc', '00:18:E4:40:00:02', 'NE', 'Góc Đông Bắc', '1.0.0', 'WEAK_SIGNAL', 'OK', -81, 96.80, UTC_TIMESTAMP(3) - INTERVAL 4 SECOND),
  (@room_id, @gateway_id, 'NODE-SW', 'Node Tây Nam', '00:18:E4:40:00:03', 'SW', 'Góc Tây Nam', '1.0.0', 'ONLINE', 'OK', -62, 99.10, UTC_TIMESTAMP(3) - INTERVAL 3 SECOND),
  (@room_id, @gateway_id, 'NODE-SE', 'Node Đông Nam', '00:18:E4:40:00:04', 'SE', 'Góc Đông Nam', '1.0.0', 'ONLINE', 'OK', -59, 99.60, UTC_TIMESTAMP(3) - INTERVAL 1 SECOND)
ON DUPLICATE KEY UPDATE
  room_id = VALUES(room_id),
  gateway_id = VALUES(gateway_id),
  node_name = VALUES(node_name),
  location_label = VALUES(location_label),
  firmware_version = VALUES(firmware_version),
  node_status = VALUES(node_status),
  sensor_health = VALUES(sensor_health),
  signal_rssi = VALUES(signal_rssi),
  packet_success_rate = VALUES(packet_success_rate),
  last_seen_at = VALUES(last_seen_at);

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
VALUES
  ((SELECT id FROM sensor_nodes WHERE node_code = 'NODE-NW'), @gateway_id, 'DEMO-NODE-NW-LATEST', 28.1, 57, 1008, 418, 74, 'NORMAL', 'VALID', NULL, -57, UTC_TIMESTAMP(3) - INTERVAL 2 SECOND, UTC_TIMESTAMP(3)),
  ((SELECT id FROM sensor_nodes WHERE node_code = 'NODE-NE'), @gateway_id, 'DEMO-NODE-NE-LATEST', 28.5, 59, 1007, 405, 78, 'NORMAL', 'VALID', NULL, -81, UTC_TIMESTAMP(3) - INTERVAL 4 SECOND, UTC_TIMESTAMP(3)),
  ((SELECT id FROM sensor_nodes WHERE node_code = 'NODE-SW'), @gateway_id, 'DEMO-NODE-SW-LATEST', 28.1, 57, 1008, 418, 73, 'NORMAL', 'VALID', NULL, -62, UTC_TIMESTAMP(3) - INTERVAL 3 SECOND, UTC_TIMESTAMP(3)),
  ((SELECT id FROM sensor_nodes WHERE node_code = 'NODE-SE'), @gateway_id, 'DEMO-NODE-SE-LATEST', 28.3, 58, 1009, 427, 75, 'NORMAL', 'VALID', NULL, -59, UTC_TIMESTAMP(3) - INTERVAL 1 SECOND, UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  gateway_id = VALUES(gateway_id),
  temperature_c = VALUES(temperature_c),
  humidity_percent = VALUES(humidity_percent),
  pressure_hpa = VALUES(pressure_hpa),
  light_lux = VALUES(light_lux),
  air_quality_ppm = VALUES(air_quality_ppm),
  air_quality_status = VALUES(air_quality_status),
  data_status = VALUES(data_status),
  error_flags = VALUES(error_flags),
  ble_rssi = VALUES(ble_rssi),
  sampled_at = VALUES(sampled_at),
  received_at = VALUES(received_at);

COMMIT;
