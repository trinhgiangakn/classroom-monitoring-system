-- Add online status tracking columns to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_online TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_login DATETIME NULL,
    ADD COLUMN IF NOT EXISTS last_active_at DATETIME NULL;
