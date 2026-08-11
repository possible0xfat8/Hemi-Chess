-- Migration: Add avatar_url column to players table
-- This column stores the URL of the player's avatar image in R2 storage

-- Add avatar_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE players ADD COLUMN avatar_url TEXT;
        RAISE NOTICE 'Added avatar_url column to players table';
    ELSE
        RAISE NOTICE 'avatar_url column already exists';
    END IF;
END $$;

-- Add index for faster avatar lookups
CREATE INDEX IF NOT EXISTS idx_players_avatar ON players(player_id) WHERE avatar_url IS NOT NULL;

COMMENT ON COLUMN players.avatar_url IS 'URL of the player avatar image stored in Cloudflare R2';
