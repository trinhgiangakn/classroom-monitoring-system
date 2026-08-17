-- External context only. Indoor sensor telemetry remains the source of device commands.
CREATE TABLE IF NOT EXISTS external_weather_data (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    room_code VARCHAR(30) NOT NULL DEFAULT 'P.101',
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'open-meteo',
    temperature_c DECIMAL(6,3) NULL,
    humidity_percent DECIMAL(5,2) NULL,
    precipitation_probability DECIMAL(5,2) NULL,
    precipitation_mm DECIMAL(8,3) NULL,
    wind_speed_kmh DECIMAL(8,3) NULL,
    weather_code SMALLINT NULL,
    observed_at DATETIME(3) NOT NULL,
    fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    raw_payload JSON NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_external_weather_observation (room_code, provider, observed_at),
    KEY idx_external_weather_room_fetched (room_code, fetched_at)
);
