-- Migration: Add online status tracking fields
-- Run this on existing database to add new columns

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'online',
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Update existing players to have default values
UPDATE players 
SET last_seen = COALESCE(last_active, CURRENT_TIMESTAMP),
    online_status = 'online',
    is_online = FALSE
WHERE last_seen IS NULL OR online_status IS NULL OR is_online IS NULL;

-- Create index for online status queries
CREATE INDEX IF NOT EXISTS idx_players_online ON players(is_online, online_status);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen DESC);

COMMENT ON COLUMN players.last_seen IS 'Last time user was seen online (for "Last seen" display)';
COMMENT ON COLUMN players.online_status IS 'User preference: online, offline, appear_offline';
COMMENT ON COLUMN players.is_online IS 'Actual online state based on socket connection';
