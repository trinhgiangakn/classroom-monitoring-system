CREATE TABLE gateway_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gateway_id VARCHAR(50) NOT NULL,
    cpu_usage FLOAT,
    ram_usage FLOAT,
    network_latency INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gateway_id) REFERENCES gateways(gateway_id) ON DELETE CASCADE
);