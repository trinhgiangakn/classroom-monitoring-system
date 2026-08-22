-- Liveness must be based on backend receive time in UTC. Older local setups
-- could persist UTC+7 wall-clock values into DATETIME columns; after the
-- backend switched to UTC those values appeared several hours in the future
-- and prevented the offline watchdog from expiring the device.
UPDATE sensor_nodes
SET
    node_status = 'OFFLINE',
    last_seen_at = NULL
WHERE last_seen_at > UTC_TIMESTAMP(3) + INTERVAL 60 SECOND;

UPDATE gateways
SET
    gateway_status = 'OFFLINE',
    wifi_connected = 0,
    mqtt_connected = 0,
    last_seen_at = NULL
WHERE last_seen_at > UTC_TIMESTAMP(3) + INTERVAL 60 SECOND;
