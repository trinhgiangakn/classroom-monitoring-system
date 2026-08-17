CREATE TABLE IF NOT EXISTS device_commands (
    command_id VARCHAR(50) PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    requested_by VARCHAR(50) NOT NULL,
    source ENUM('MANUAL', 'AUTO') NOT NULL,
    status ENUM('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT') DEFAULT 'PENDING',
    execution_time_ms INT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ack_received_at TIMESTAMP NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    INDEX idx_device_status (device_id, status)
);
