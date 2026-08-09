CREATE TABLE sensor_nodes (
    node_id VARCHAR(50) PRIMARY KEY,
    gateway_id VARCHAR(50) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE', 'FAULT') DEFAULT 'INACTIVE',
    battery_level INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gateway_id) REFERENCES gateways(gateway_id) ON DELETE CASCADE
);