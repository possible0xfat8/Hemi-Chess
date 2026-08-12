-- HemiChess Database Schema
-- PostgreSQL database for game history and player profiles

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(100) UNIQUE NOT NULL, -- Current localStorage ID
    wallet_address VARCHAR(42), -- Future: Ethereum wallet address
    username VARCHAR(50) NOT NULL,
    elo_rating INTEGER DEFAULT 1200,
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    online_status VARCHAR(20) DEFAULT 'online', -- 'online', 'offline', 'appear_offline'
    is_online BOOLEAN DEFAULT FALSE
);

-- Game history table
CREATE TABLE game_history (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) UNIQUE NOT NULL,
    white_player_id VARCHAR(100) NOT NULL,
    black_player_id VARCHAR(100) NOT NULL,
    winner VARCHAR(10), -- 'white', 'black', 'draw'
    result VARCHAR(50), -- 'checkmate', 'resignation', 'draw', 'timeout', etc.
    total_moves INTEGER,
    game_duration INTEGER, -- in seconds
    white_elo_before INTEGER,
    black_elo_before INTEGER,
    white_elo_after INTEGER,
    black_elo_after INTEGER,
    final_fen TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    FOREIGN KEY (white_player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    FOREIGN KEY (black_player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

-- Move history table (for game replay)
CREATE TABLE moves (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL,
    move_number INTEGER NOT NULL,
    move_san VARCHAR(10) NOT NULL, -- Standard Algebraic Notation
    fen TEXT NOT NULL,
    time_left INTEGER, -- milliseconds remaining
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game_history(game_id) ON DELETE CASCADE
);

-- Wallet linkage table (for future Web3 integration)
CREATE TABLE wallet_links (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(100) UNIQUE NOT NULL,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    signature TEXT NOT NULL, -- Signature proof of ownership
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_players_wallet ON players(wallet_address);
CREATE INDEX idx_players_elo ON players(elo_rating DESC);
CREATE INDEX idx_game_history_white ON game_history(white_player_id);
CREATE INDEX idx_game_history_black ON game_history(black_player_id);
CREATE INDEX idx_game_history_completed ON game_history(completed_at DESC);
CREATE INDEX idx_moves_game ON moves(game_id, move_number);

-- Views for easy querying

-- Player stats view
CREATE VIEW player_stats AS
SELECT 
    p.player_id,
    p.username,
    p.wallet_address,
    p.elo_rating,
    p.total_games,
    p.wins,
    p.losses,
    p.draws,
    ROUND(p.wins::NUMERIC / NULLIF(p.total_games, 0) * 100, 2) as win_rate,
    p.created_at,
    p.last_active
FROM players p;

-- Recent games view
CREATE VIEW recent_games AS
SELECT 
    gh.game_id,
    gh.white_player_id,
    wp.username as white_username,
    gh.black_player_id,
    bp.username as black_username,
    gh.winner,
    gh.result,
    gh.total_moves,
    gh.game_duration,
    gh.completed_at
FROM game_history gh
JOIN players wp ON gh.white_player_id = wp.player_id
JOIN players bp ON gh.black_player_id = bp.player_id
ORDER BY gh.completed_at DESC;

-- Player game history (with perspective)
CREATE OR REPLACE FUNCTION get_player_games(p_player_id VARCHAR)
RETURNS TABLE (
    game_id VARCHAR,
    opponent_id VARCHAR,
    opponent_username VARCHAR,
    my_color VARCHAR,
    result VARCHAR,
    outcome VARCHAR, -- 'win', 'loss', 'draw'
    my_elo_before INTEGER,
    my_elo_after INTEGER,
    elo_change INTEGER,
    total_moves INTEGER,
    completed_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gh.game_id,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN gh.black_player_id
            ELSE gh.white_player_id
        END as opponent_id,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN bp.username
            ELSE wp.username
        END as opponent_username,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN 'white'
            ELSE 'black'
        END as my_color,
        gh.result,
        CASE 
            WHEN gh.winner = 'draw' THEN 'draw'
            WHEN (gh.winner = 'white' AND gh.white_player_id = p_player_id) 
                OR (gh.winner = 'black' AND gh.black_player_id = p_player_id) THEN 'win'
            ELSE 'loss'
        END as outcome,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN gh.white_elo_before
            ELSE gh.black_elo_before
        END as my_elo_before,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN gh.white_elo_after
            ELSE gh.black_elo_after
        END as my_elo_after,
        CASE 
            WHEN gh.white_player_id = p_player_id THEN (gh.white_elo_after - gh.white_elo_before)
            ELSE (gh.black_elo_after - gh.black_elo_before)
        END as elo_change,
        gh.total_moves,
        gh.completed_at
    FROM game_history gh
    JOIN players wp ON gh.white_player_id = wp.player_id
    JOIN players bp ON gh.black_player_id = bp.player_id
    WHERE gh.white_player_id = p_player_id OR gh.black_player_id = p_player_id
    ORDER BY gh.completed_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Leaderboard view (top 100 players by ELO)
CREATE VIEW leaderboard AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY elo_rating DESC) as rank,
    player_id,
    username,
    wallet_address,
    elo_rating,
    total_games,
    wins,
    losses,
    draws,
    ROUND(wins::NUMERIC / NULLIF(total_games, 0) * 100, 2) as win_rate
FROM players
WHERE total_games >= 10 -- Minimum games for leaderboard
ORDER BY elo_rating DESC
LIMIT 100;
