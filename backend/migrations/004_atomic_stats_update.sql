-- Migration: Atomic Player Stats Update Function
-- Purpose: Prevent double-counting race condition when games finish simultaneously
-- Date: 2026-08-12

-- Create function for atomic stats update
CREATE OR REPLACE FUNCTION update_player_stats_atomic(
  p_player_id TEXT,
  p_win_inc INTEGER DEFAULT 0,
  p_loss_inc INTEGER DEFAULT 0,
  p_draw_inc INTEGER DEFAULT 0,
  p_new_elo INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Atomic UPDATE with increments - prevents read-modify-write race condition
  UPDATE players 
  SET 
    total_games = total_games + 1,
    wins = wins + p_win_inc,
    losses = losses + p_loss_inc,
    draws = draws + p_draw_inc,
    elo_rating = COALESCE(p_new_elo, elo_rating),  -- Only update if provided
    updated_at = NOW()
  WHERE player_id = p_player_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_player_stats_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION update_player_stats_atomic TO anon;
GRANT EXECUTE ON FUNCTION update_player_stats_atomic TO service_role;

COMMENT ON FUNCTION update_player_stats_atomic IS 'Atomically updates player statistics to prevent double-counting race conditions';
