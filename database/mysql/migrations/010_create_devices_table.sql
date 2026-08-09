CREATE TABLE devices (
    device_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('RELAY', 'MOTOR') NOT NULL,
    actual_state VARCHAR(20) NOT NULL,
    desired_state VARCHAR(20) NULL,
    operation_mode ENUM('AUTO', 'MANUAL') DEFAULT 'AUTO',
    limit_open_status VARCHAR(10) DEFAULT 'OK',
    limit_close_status VARCHAR(10) DEFAULT 'OK',
    timeout_seconds INT DEFAULT 30,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);