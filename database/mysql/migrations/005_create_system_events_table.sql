CREATE TABLE IF NOT EXISTS system_events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    service_id VARCHAR(50),
    event_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES system_services(service_id) ON DELETE SET NULL
);
