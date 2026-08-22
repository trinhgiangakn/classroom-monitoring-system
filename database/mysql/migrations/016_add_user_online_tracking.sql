-- Add online status tracking columns to users table
ALTER TABLE users ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login DATETIME NULL;
ALTER TABLE users ADD COLUMN last_active_at DATETIME NULL;
