-- raw data
CREATE TABLE sensor_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL,
    temperature FLOAT,
    humidity FLOAT,
    light_level FLOAT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id) ON DELETE CASCADE
);

-- Dữ liệu tổng hợp theo giờ
CREATE TABLE sensor_data_hourly (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL,
    avg_temperature FLOAT,
    avg_humidity FLOAT,
    recorded_hour TIMESTAMP NOT NULL,
    FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id) ON DELETE CASCADE
);

-- Dữ liệu tổng hợp theo ngày
CREATE TABLE sensor_data_daily (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id VARCHAR(50) NOT NULL,
    avg_temperature FLOAT,
    avg_humidity FLOAT,
    recorded_date DATE NOT NULL,
    FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id) ON DELETE CASCADE
);