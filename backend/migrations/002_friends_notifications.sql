-- HemiChess Friends & Notifications Schema
-- Migration: Add social features and notification system

-- ============================================================================
-- FRIENDS TABLE
-- ============================================================================
-- Stores friendship relationships between players
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    friend_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys reference players table
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_friend FOREIGN KEY (friend_id) REFERENCES players(player_id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT chk_status CHECK (status IN ('pending', 'accepted', 'declined')),
    CONSTRAINT chk_not_self CHECK (user_id != friend_id),
    CONSTRAINT uniq_friendship UNIQUE (user_id, friend_id)
);

-- Indexes for performance
CREATE INDEX idx_friends_user ON friends(user_id);
CREATE INDEX idx_friends_friend ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);
CREATE INDEX idx_friends_user_status ON friends(user_id, status);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- Stores all notifications (friend requests, match challenges, etc.)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_id VARCHAR(100) NOT NULL,
    sender_id VARCHAR(100),
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unread',
    data JSONB, -- Additional data (e.g., game_id for challenges)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_recipient FOREIGN KEY (recipient_id) REFERENCES players(player_id) ON DELETE CASCADE,
    CONSTRAINT fk_sender FOREIGN KEY (sender_id) REFERENCES players(player_id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT chk_type CHECK (type IN ('friend_request', 'match_challenge', 'friend_accepted', 'system')),
    CONSTRAINT chk_notification_status CHECK (status IN ('unread', 'read', 'accepted', 'declined', 'expired'))
);

-- Indexes for performance
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_sender ON notifications(sender_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_recipient_status ON notifications(recipient_id, status);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- Friends list view with full player details
CREATE OR REPLACE VIEW friends_list AS
SELECT 
    f.id,
    f.user_id,
    f.friend_id,
    f.status,
    f.created_at,
    p.username as friend_username,
    p.elo_rating as friend_elo,
    p.wallet_address as friend_wallet,
    p.last_active as friend_last_active,
    p.total_games as friend_total_games,
    p.wins as friend_wins
FROM friends f
JOIN players p ON f.friend_id = p.player_id;

-- Notifications view with sender details
CREATE OR REPLACE VIEW notifications_detailed AS
SELECT 
    n.id,
    n.recipient_id,
    n.sender_id,
    n.type,
    n.status,
    n.data,
    n.created_at,
    n.read_at,
    s.username as sender_username,
    s.elo_rating as sender_elo,
    s.wallet_address as sender_wallet
FROM notifications n
LEFT JOIN players s ON n.sender_id = s.player_id;

-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Get all friends for a player (accepted only)
CREATE OR REPLACE FUNCTION get_friends(p_player_id VARCHAR)
RETURNS TABLE (
    friend_id VARCHAR,
    username VARCHAR,
    elo_rating INTEGER,
    wallet_address VARCHAR,
    total_games INTEGER,
    wins INTEGER,
    last_active TIMESTAMP,
    friendship_since TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.player_id,
        p.username,
        p.elo_rating,
        p.wallet_address,
        p.total_games,
        p.wins,
        p.last_active,
        f.created_at as friendship_since
    FROM friends f
    JOIN players p ON (
        CASE 
            WHEN f.user_id = p_player_id THEN p.player_id = f.friend_id
            ELSE p.player_id = f.user_id
        END
    )
    WHERE (f.user_id = p_player_id OR f.friend_id = p_player_id)
        AND f.status = 'accepted'
    ORDER BY p.username;
END;
$$ LANGUAGE plpgsql;

-- Get pending friend requests (incoming)
CREATE OR REPLACE FUNCTION get_pending_requests(p_player_id VARCHAR)
RETURNS TABLE (
    request_id INTEGER,
    sender_id VARCHAR,
    sender_username VARCHAR,
    sender_elo INTEGER,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.user_id,
        p.username,
        p.elo_rating,
        f.created_at
    FROM friends f
    JOIN players p ON f.user_id = p.player_id
    WHERE f.friend_id = p_player_id
        AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get unread notifications count
CREATE OR REPLACE FUNCTION get_unread_count(p_player_id VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO unread_count
    FROM notifications
    WHERE recipient_id = p_player_id
        AND status = 'unread';
    
    RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Check if friendship exists (in any state)
CREATE OR REPLACE FUNCTION friendship_exists(p_user_id VARCHAR, p_friend_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    exists_flag BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1
        FROM friends
        WHERE (user_id = p_user_id AND friend_id = p_friend_id)
           OR (user_id = p_friend_id AND friend_id = p_user_id)
    ) INTO exists_flag;
    
    RETURN exists_flag;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp on friends table
CREATE OR REPLACE FUNCTION update_friends_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER friends_updated_at
    BEFORE UPDATE ON friends
    FOR EACH ROW
    EXECUTE FUNCTION update_friends_timestamp();

-- Auto-update read_at when notification status changes to read
CREATE OR REPLACE FUNCTION update_notification_read_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('read', 'accepted', 'declined') AND OLD.status = 'unread' THEN
        NEW.read_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_read_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_read_at();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to add sample friendships for testing
-- INSERT INTO friends (user_id, friend_id, status) VALUES
-- ('player1', 'player2', 'accepted'),
-- ('player1', 'player3', 'pending'),
-- ('player4', 'player1', 'pending');
