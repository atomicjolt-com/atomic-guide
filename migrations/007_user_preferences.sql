-- Migration: 007_user_preferences.sql
-- Description: Add user preferences table for syncing user settings across devices

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  preferences TEXT NOT NULL, -- JSON object storing preferences
  timestamp TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint for tenant, user, and device combination
  UNIQUE(tenant_id, user_id, device_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_tenant_user 
  ON user_preferences(tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at 
  ON user_preferences(updated_at DESC);

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
  AFTER UPDATE ON user_preferences
  FOR EACH ROW
  BEGIN
    UPDATE user_preferences 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
  END;