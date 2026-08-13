/**
 * Supabase Client for HemiChess
 * Uses HTTPS REST API instead of direct PostgreSQL connection
 * Works everywhere (local, Cloudflare, etc.) - no firewall issues!
 */

const { createClient } = require('@supabase/supabase-js');
const { calculateMatchElo } = require('./services/eloMath');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

// Declare these at module scope so they can be exported
let supabase = null;
let isEnabled = false;

console.log('[SUPABASE] Initialization check:');
console.log('[SUPABASE] - URL present:', !!supabaseUrl);
console.log('[SUPABASE] - URL value:', supabaseUrl ? `${supabaseUrl.slice(0, 30)}...` : 'NOT SET');
console.log('[SUPABASE] - Key present:', !!supabaseKey);
console.log('[SUPABASE] - Key length:', supabaseKey?.length || 0);

if (!supabaseUrl || !supabaseKey) {
  console.log('[SUPABASE] ⚠ Environment variables not configured');
  console.log('[SUPABASE] ⚠ Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env');
  console.log('[SUPABASE] ⚠ URL:', supabaseUrl || 'MISSING');
  console.log('[SUPABASE] ⚠ Key:', supabaseKey ? 'Present but empty after validation' : 'MISSING');
  console.log('[SUPABASE] ⚠ isEnabled will remain:', isEnabled);
} else {
  try {
    console.log('[SUPABASE] Creating client with URL:', supabaseUrl.slice(0, 40));
    supabase = createClient(supabaseUrl, supabaseKey);
    isEnabled = true;
    console.log('[SUPABASE] ✓ Client object created');
    console.log('[SUPABASE] ✓ isEnabled set to:', isEnabled);
    console.log('[SUPABASE] ✓ supabase object type:', typeof supabase);
    console.log('[SUPABASE] ✓ Testing connection...');
    
    // Test the connection with a simple query
    supabase
      .from('players')
      .select('count')
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.error('[SUPABASE] ✗ Connection test failed:', error.message);
          console.error('[SUPABASE] ✗ Error code:', error.code);
          console.error('[SUPABASE] ✗ Error details:', error.details);
        } else {
          console.log('[SUPABASE] ✓ Connection test successful');
        }
      })
      .catch(err => {
        console.error('[SUPABASE] ✗ Connection test error:', err.message);
        console.error('[SUPABASE] ✗ Error stack:', err.stack);
      });
  } catch (error) {
    console.error('[SUPABASE] ✗ Client initialization failed:', error.message);
    console.error('[SUPABASE] ✗ Error stack:', error.stack);
    supabase = null;
    isEnabled = false;
    console.log('[SUPABASE] ✗ isEnabled set to FALSE due to error');
  }
}

console.log('[SUPABASE] Final module state - isEnabled:', isEnabled, 'supabase:', !!supabase);

// Re-export database functions using Supabase client
// NOTE: Don't destructure here - we'll export at the bottom

// Every new player starts here (database AND chain)
const DEFAULT_ELO = 1200;

// Normalize a player row so elo_rating is always a sane number
function normalizePlayer(row) {
  if (!row) return null;
  const total_games = row.total_games ?? 0;
  const wins = row.wins ?? 0;
  return {
    ...row,
    elo_rating:
      row.elo_rating === null || row.elo_rating === undefined
        ? DEFAULT_ELO
        : Math.round(Number(row.elo_rating)),
    total_games,
    wins,
    losses: row.losses ?? 0,
    draws: row.draws ?? 0,
    win_rate: total_games > 0 ? Math.round((wins / total_games) * 100) : 0,
  };
}

// User stats by wallet
async function getUserStatsByWallet(walletAddress) {
  if (!isEnabled) return null;
  
  try {
    const { data, error } = await supabase
      .from('players')
      .select('player_id, username, wallet_address, avatar_url, elo_rating, total_games, wins, losses, draws, last_seen, online_status, is_online')
      .eq('wallet_address', walletAddress.toLowerCase())
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No user found - auto-create with the default 1200 rating
        return normalizePlayer(await upsertUserByWallet(walletAddress));
      }
      throw error;
    }
    
    // Return ELO from database (source of truth for display)
    return normalizePlayer(data);
  } catch (err) {
    console.error('[DB] Error getting user stats:', err.message);
    return null;
  }
}


// Match history by wallet
async function getMatchHistoryByWallet(walletAddress, limit = 10) {
  if (!isEnabled) return [];
  
  try {
    const playerId = walletAddress.toLowerCase();
    
    const { data, error } = await supabase
      .from('game_history')
      .select('game_id, winner, result, total_moves, completed_at, white_player_id, black_player_id')
      .or(`white_player_id.eq.${playerId},black_player_id.eq.${playerId}`)
      .order('completed_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    // Transform data to match expected format
    // NOTE: elo_before/elo_after removed - not relevant since ELO is on-chain
    return data.map(game => ({
      game_id: game.game_id,
      my_color: game.white_player_id === playerId ? 'white' : 'black',
      outcome: game.winner === 'draw' ? 'D' : 
               (game.winner === 'white' && game.white_player_id === playerId) ||
               (game.winner === 'black' && game.black_player_id === playerId) ? 'W' : 'L',
      completed_at: game.completed_at,
    }));
  } catch (err) {
    console.error('[SUPABASE] Error getting match history:', err.message);
    return [];
  }
}

// Upsert user by wallet.
// IMPORTANT: never clobbers an existing elo_rating. New players are created
// with DEFAULT_ELO (1200) so the database always has a concrete rating.
async function upsertUserByWallet(walletAddress, username = null) {
  if (!isEnabled) return null;
  
  try {
    const playerId = walletAddress.toLowerCase();
    const displayName = username || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    
    const { data: existing, error: readError } = await supabase
      .from('players')
      .select('player_id, username, wallet_address, avatar_url, elo_rating, total_games, wins, losses, draws')
      .eq('player_id', playerId)
      .maybeSingle();
    
    if (readError && readError.code !== 'PGRST116') throw readError;
    
    if (existing) {
      const updateData = { last_active: new Date().toISOString() };
      if (username) updateData.username = username;
      // Backfill a missing rating without ever overwriting a real one
      if (existing.elo_rating === null || existing.elo_rating === undefined) {
        updateData.elo_rating = DEFAULT_ELO;
      }
      
      const { data, error } = await supabase
        .from('players')
        .update(updateData)
        .eq('player_id', playerId)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, isNew: false };
    }
    
    const { data, error } = await supabase
      .from('players')
      .insert({
        player_id: playerId,
        username: displayName,
        wallet_address: playerId,
        elo_rating: DEFAULT_ELO,
        total_games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        last_active: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      // Lost an insert race - read the winning row back
      if (error.code === '23505') {
        const { data: raced } = await supabase
          .from('players')
          .select('*')
          .eq('player_id', playerId)
          .single();
        return { ...raced, isNew: false };
      }
      throw error;
    }
    
    console.log(`[DB] ✓ Created player ${playerId.slice(0, 10)}... with ${DEFAULT_ELO} ELO`);
    return { ...data, isNew: true };
  } catch (err) {
    console.error('[SUPABASE] Error upserting user:', err.message);
    throw err;
  }
}


// Record match result. DATABASE IS THE SOURCE OF TRUTH.
// - Idempotent: a gameId that was already recorded never double-counts stats.
// - Ratings used for the calculation are re-read from the database so a stale
//   in-memory value can never drift the ledger.
async function recordMatchResult(matchData) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const {
      gameId,
      whiteAddress,
      blackAddress,
      winner,
      fenString,
      whiteElo: whiteEloHint,
      blackElo: blackEloHint,
      totalMoves = 0,
      gameDuration = 0,
      result: resultReason = 'settlement',
      timestamp
    } = matchData;
    
    const whitePlayerId = whiteAddress.toLowerCase();
    const blackPlayerId = blackAddress.toLowerCase();
    const ts = timestamp || Math.floor(Date.now() / 1000);
    
    // --- Idempotency guard: has this game already been settled? ---
    const { data: existingGame } = await supabase
      .from('game_history')
      .select('game_id, white_elo_before, black_elo_before, white_elo_after, black_elo_after')
      .eq('game_id', gameId)
      .maybeSingle();
    
    if (existingGame) {
      console.log(`[DB] ↺ Game ${gameId} already recorded - skipping duplicate settlement`);
      return {
        success: true,
        alreadyRecorded: true,
        whiteEloAfter: existingGame.white_elo_after,
        blackEloAfter: existingGame.black_elo_after,
        whiteChange: existingGame.white_elo_after - existingGame.white_elo_before,
        blackChange: existingGame.black_elo_after - existingGame.black_elo_before,
      };
    }
    
    // Ensure both players exist (creates them with 1200 if brand new)
    const whitePlayer = normalizePlayer(await upsertUserByWallet(whiteAddress));
    const blackPlayer = normalizePlayer(await upsertUserByWallet(blackAddress));
    
    // Authoritative pre-match ratings come from the database
    const whiteElo = whitePlayer?.elo_rating ?? whiteEloHint ?? DEFAULT_ELO;
    const blackElo = blackPlayer?.elo_rating ?? blackEloHint ?? DEFAULT_ELO;
    
    const eloChanges = calculateMatchElo(whiteElo, blackElo, winner);
    const whiteEloAfter = eloChanges.white.newRating;
    const blackEloAfter = eloChanges.black.newRating;
    
    console.log(`[DB] ELO Changes - White: ${whiteElo} → ${whiteEloAfter} (${eloChanges.white.change >= 0 ? '+' : ''}${eloChanges.white.change})`);
    console.log(`[DB] ELO Changes - Black: ${blackElo} → ${blackEloAfter} (${eloChanges.black.change >= 0 ? '+' : ''}${eloChanges.black.change})`);
    
    // Insert game history (with ELO snapshot for historical records)
    const { error: gameError } = await supabase
      .from('game_history')
      .insert({
        game_id: gameId,
        white_player_id: whitePlayerId,
        black_player_id: blackPlayerId,
        winner: winner,
        result: resultReason,
        total_moves: totalMoves,
        game_duration: gameDuration,
        white_elo_before: whiteElo,
        black_elo_before: blackElo,
        white_elo_after: whiteEloAfter,
        black_elo_after: blackEloAfter,
        final_fen: fenString,
        started_at: new Date(ts * 1000).toISOString(),
        completed_at: new Date(ts * 1000).toISOString(),
      });
    
    if (gameError) {
      // Concurrent settlement won the race - do NOT apply stats twice
      if (gameError.code === '23505') {
        console.log(`[DB] ↺ Game ${gameId} recorded concurrently - skipping duplicate stats`);
        return {
          success: true,
          alreadyRecorded: true,
          whiteEloAfter,
          blackEloAfter,
          whiteChange: eloChanges.white.change,
          blackChange: eloChanges.black.change,
        };
      }
      throw gameError;
    }
    
    // Update player W/L/D stats AND ELO (database is source of truth)
    const whiteOutcome = winner === 'white' ? 'win' : winner === 'draw' ? 'draw' : 'loss';
    const blackOutcome = winner === 'black' ? 'win' : winner === 'draw' ? 'draw' : 'loss';
    
    await updatePlayerStats(whitePlayerId, whiteOutcome, whiteEloAfter);
    await updatePlayerStats(blackPlayerId, blackOutcome, blackEloAfter);
    
    console.log(`[DB] ✓ Recorded match result: ${gameId}`);
    
    // Return new ELO values for immediate feedback
    return {
      success: true,
      alreadyRecorded: false,
      whiteEloBefore: whiteElo,
      blackEloBefore: blackElo,
      whiteEloAfter,
      blackEloAfter,
      whiteChange: eloChanges.white.change,
      blackChange: eloChanges.black.change
    };

  } catch (err) {
    console.error('[DB] Error recording match result:', err.message);
    return { success: false, error: err.message };
  }
}

// Helper: Update player stats (W/L/D AND ELO)
// ELO is now stored in database as source of truth for display
// FIX: Use atomic increment via RPC to prevent race conditions
async function updatePlayerStats(playerId, outcome, newElo = null) {
  if (!isEnabled) return;
  
  try {
    // CRITICAL FIX: Use RPC function for atomic increment to avoid read-modify-write race condition
    // This prevents double-counting when two games finish simultaneously
    
    let winInc = 0, lossInc = 0, drawInc = 0;
    if (outcome === 'win') winInc = 1;
    else if (outcome === 'loss') lossInc = 1;
    else if (outcome === 'draw') drawInc = 1;
    
    // Call RPC function that does atomic SQL: UPDATE players SET wins = wins + 1, ...
    const { error: rpcError } = await supabase.rpc('update_player_stats_atomic', {
      p_player_id: playerId,
      p_win_inc: winInc,
      p_loss_inc: lossInc,
      p_draw_inc: drawInc,
      p_new_elo: newElo !== null ? Math.round(newElo) : null
    });
    
    if (rpcError) {
      // RPC function doesn't exist - use fallback with explicit SELECT FOR UPDATE
      console.warn('[DB] RPC not found, using fallback (may have race conditions)');
      
      // Fallback: Read current stats
      const { data: player } = await supabase
        .from('players')
        .select('total_games, wins, losses, draws, elo_rating')
        .eq('player_id', playerId)
        .single();
      
      if (!player) return;
      
      // Build update object
      const updateData = {
        total_games: (player.total_games ?? 0) + 1,
        wins: (player.wins ?? 0) + winInc,
        losses: (player.losses ?? 0) + lossInc,
        draws: (player.draws ?? 0) + drawInc,
        updated_at: new Date().toISOString(),
      };
      
      if (newElo !== null) {
        updateData.elo_rating = Math.round(newElo);
      }
      
      // Update with fallback method
      await supabase
        .from('players')
        .update(updateData)
        .eq('player_id', playerId);
    }
      
    if (newElo !== null) {
      console.log(`[DB] Updated ${playerId.slice(0, 8)}... stats (${outcome}) and ELO → ${Math.round(newElo)}`);
    }
  } catch (err) {
    console.error('[DB] Error updating player stats:', err.message);
  }
}

// List players (used by the admin blockchain-sync dashboard)
async function listPlayers(limit = 100) {
  if (!isEnabled) return [];
  
  try {
    const { data, error } = await supabase
      .from('players')
      .select('player_id, username, wallet_address, avatar_url, elo_rating, total_games, wins, losses, draws')
      .not('wallet_address', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []).map(normalizePlayer);
  } catch (err) {
    console.error('[DB] Error listing players:', err.message);
    return [];
  }
}

// Count total players
async function countPlayers() {
  if (!isEnabled) return 0;
  
  try {
    const { count, error } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .not('wallet_address', 'is', null);
    
    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[DB] Error counting players:', err.message);
    return 0;
  }
}

// Get leaderboard (ranked by ELO)
// Players WITH games are prioritized over players WITHOUT games
async function getLeaderboard(limit = 100, minGames = 0) {
  if (!isEnabled) return [];
  
  try {
    const { data, error } = await supabase
      .from('players')
      .select('player_id, username, wallet_address, avatar_url, elo_rating, total_games, wins, losses, draws')
      .not('wallet_address', 'is', null)
      .gte('total_games', minGames)
      .order('elo_rating', { ascending: false })
      .order('wins', { ascending: false }) // Tiebreaker
      .limit(limit * 2); // Fetch more to ensure we have enough after sorting
    
    if (error) throw error;
    
    // Sort: Players with games > 0 first, then by ELO, then by wins
    const sorted = (data || []).sort((a, b) => {
      // Primary sort: Has played games (total_games > 0)
      const aHasGames = (a.total_games || 0) > 0 ? 1 : 0;
      const bHasGames = (b.total_games || 0) > 0 ? 1 : 0;
      
      if (aHasGames !== bHasGames) {
        return bHasGames - aHasGames; // Players with games first
      }
      
      // Secondary sort: ELO rating (descending)
      const aElo = a.elo_rating || DEFAULT_ELO;
      const bElo = b.elo_rating || DEFAULT_ELO;
      
      if (aElo !== bElo) {
        return bElo - aElo; // Higher ELO first
      }
      
      // Tertiary sort: Wins (descending)
      const aWins = a.wins || 0;
      const bWins = b.wins || 0;
      
      return bWins - aWins; // More wins first
    });
    
    // Limit after sorting and add rank
    return sorted.slice(0, limit).map((player, index) => {
      const normalized = normalizePlayer(player);
      return {
        rank: index + 1,
        ...normalized,
      };
    });
  } catch (err) {
    console.error('[DB] Error getting leaderboard:', err.message);
    return [];
  }
}

// Update player username
async function updatePlayerUsername(playerId, username) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    // Validate username
    if (!username || typeof username !== 'string') {
      return { success: false, error: 'Username is required' };
    }
    
    const trimmedUsername = username.trim();
    
    if (trimmedUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    
    if (trimmedUsername.length > 20) {
      return { success: false, error: 'Username must be 20 characters or less' };
    }
    
    // Update username in database
    const { data, error } = await supabase
      .from('players')
      .update({
        username: trimmedUsername,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId.toLowerCase())
      .select('player_id, username, wallet_address, elo_rating, total_games, wins, losses, draws')
      .single();
    
    if (error) {
      console.error('[DB] Error updating username:', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: false, error: 'Player not found' };
    }
    
    console.log(`[DB] ✓ Updated username for ${playerId.slice(0, 8)}... → "${trimmedUsername}"`);
    
    return {
      success: true,
      player: normalizePlayer(data),
    };
  } catch (err) {
    console.error('[DB] Error updating username:', err.message);
    return { success: false, error: err.message };
  }
}

// Update player avatar URL
async function updatePlayerAvatar(playerId, avatarUrl) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const { data, error } = await supabase
      .from('players')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId.toLowerCase())
      .select('player_id, username, wallet_address, avatar_url')
      .single();
    
    if (error) {
      console.error('[DB] Error updating avatar:', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: false, error: 'Player not found' };
    }
    
    console.log(`[DB] ✓ Updated avatar for ${playerId.slice(0, 8)}...`);
    
    return { success: true, player: data };
  } catch (err) {
    console.error('[DB] updatePlayerAvatar error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  supabase,
  isEnabled,
  DEFAULT_ELO,
  normalizePlayer,
  getUserStatsByWallet,
  getMatchHistoryByWallet,
  upsertUserByWallet,
  recordMatchResult,
  updatePlayerUsername,
  updatePlayerAvatar,
  listPlayers,
  countPlayers,
  getLeaderboard,
  // Friends
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriendsList,
  getPendingFriendRequests,
  // Notifications
  createNotification,
  getNotifications,
  markNotificationRead,
  updateNotificationStatus,
  getUnreadCount,
  deleteNotification,
  // Search
  searchPlayers,
  // Online Status
  setUserOnlineStatus,
  setUserStatusPreference,
  getUserOnlineStatus,
  getOnlineUsers,
  updateLastSeen,
};


// ============================================================================
// FRIENDS MANAGEMENT
// ============================================================================

/**
 * Send a friend request
 * @param {string} userId - Player sending the request
 * @param {string} friendId - Player receiving the request
 * @returns {Promise<{success: boolean, friendship?: any, error?: string}>}
 */
async function sendFriendRequest(userId, friendId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    // Validate inputs
    if (!userId || !friendId) {
      return { success: false, error: 'User ID and Friend ID are required' };
    }
    
    if (userId.toLowerCase() === friendId.toLowerCase()) {
      return { success: false, error: 'Cannot add yourself as a friend' };
    }
    
    const userIdLower = userId.toLowerCase();
    const friendIdLower = friendId.toLowerCase();
    
    // Check if friend exists
    const { data: friendPlayer, error: friendError } = await supabase
      .from('players')
      .select('player_id, username')
      .eq('player_id', friendIdLower)
      .maybeSingle();
    
    if (friendError || !friendPlayer) {
      return { success: false, error: 'Player not found' };
    }
    
    // Check if friendship already exists (in any direction)
    const { data: existing } = await supabase
      .from('friends')
      .select('id, status, user_id, friend_id')
      .or(`and(user_id.eq.${userIdLower},friend_id.eq.${friendIdLower}),and(user_id.eq.${friendIdLower},friend_id.eq.${userIdLower})`)
      .maybeSingle();
    
    if (existing) {
      if (existing.status === 'accepted') {
        return { success: false, error: 'Already friends' };
      } else if (existing.status === 'pending') {
        // Check if this is an incoming request we should auto-accept
        if (existing.friend_id === userIdLower) {
          // They sent us a request, we can accept it
          return await acceptFriendRequest(existing.id, userIdLower);
        }
        return { success: false, error: 'Friend request already pending' };
      }
    }
    
    // Create friendship record
    const { data: friendship, error } = await supabase
      .from('friends')
      .insert({
        user_id: userIdLower,
        friend_id: friendIdLower,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Create notification for recipient
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .insert({
        recipient_id: friendIdLower,
        sender_id: userIdLower,
        type: 'friend_request',
        status: 'unread',
        data: { friendship_id: friendship.id },
      })
      .select()
      .single();
    
    if (notifError) {
      console.error('[FRIENDS] Error creating notification:', notifError);
    }
    
    console.log(`[FRIENDS] ${userIdLower.slice(0, 8)}... sent friend request to ${friendIdLower.slice(0, 8)}...`);
    
    return { success: true, friendship, notification };
  } catch (err) {
    console.error('[FRIENDS] Error sending friend request:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Accept a friend request
 * @param {number} friendshipId - ID of the friendship record
 * @param {string} userId - User accepting the request (must be the friend_id)
 * @returns {Promise<{success: boolean, friendship?: any, error?: string}>}
 */
async function acceptFriendRequest(friendshipId, userId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    
    // Get the friendship record
    const { data: friendship, error: fetchError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status')
      .eq('id', friendshipId)
      .single();
    
    if (fetchError || !friendship) {
      return { success: false, error: 'Friend request not found' };
    }
    
    // Verify the user is the recipient
    if (friendship.friend_id !== userIdLower) {
      return { success: false, error: 'Not authorized to accept this request' };
    }
    
    // Update friendship status
    const { data: updated, error: updateError } = await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Update the notification status to accepted
    await supabase
      .from('notifications')
      .update({ status: 'accepted' })
      .eq('type', 'friend_request')
      .eq('data->>friendship_id', friendshipId.toString());
    
    // Create a notification for the requester that their request was accepted
    await supabase
      .from('notifications')
      .insert({
        recipient_id: friendship.user_id,
        sender_id: userIdLower,
        type: 'friend_accepted',
        status: 'unread',
        data: { friendship_id: friendshipId },
      });
    
    console.log(`[FRIENDS] ${userIdLower.slice(0, 8)}... accepted friend request from ${friendship.user_id.slice(0, 8)}...`);
    
    return { success: true, friendship: updated };
  } catch (err) {
    console.error('[FRIENDS] Error accepting friend request:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Decline a friend request
 * @param {number} friendshipId - ID of the friendship record
 * @param {string} userId - User declining the request
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function declineFriendRequest(friendshipId, userId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    
    // Get the friendship record
    const { data: friendship, error: fetchError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status')
      .eq('id', friendshipId)
      .single();
    
    if (fetchError || !friendship) {
      return { success: false, error: 'Friend request not found' };
    }
    
    // Verify the user is the recipient
    if (friendship.friend_id !== userIdLower) {
      return { success: false, error: 'Not authorized to decline this request' };
    }
    
    // Delete the friendship record
    const { error: deleteError } = await supabase
      .from('friends')
      .delete()
      .eq('id', friendshipId);
    
    if (deleteError) throw deleteError;
    
    // Update the notification status to declined
    await supabase
      .from('notifications')
      .update({ status: 'declined' })
      .eq('type', 'friend_request')
      .eq('data->>friendship_id', friendshipId.toString());
    
    console.log(`[FRIENDS] ${userIdLower.slice(0, 8)}... declined friend request`);
    
    return { success: true };
  } catch (err) {
    console.error('[FRIENDS] Error declining friend request:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Remove a friend (unfriend)
 * @param {string} userId - User removing the friend
 * @param {string} friendId - Friend to remove
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function removeFriend(userId, friendId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    const friendIdLower = friendId.toLowerCase();
    
    // Delete friendship (works in either direction)
    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id.eq.${userIdLower},friend_id.eq.${friendIdLower}),and(user_id.eq.${friendIdLower},friend_id.eq.${userIdLower})`);
    
    if (error) throw error;
    
    console.log(`[FRIENDS] ${userIdLower.slice(0, 8)}... removed friend ${friendIdLower.slice(0, 8)}...`);
    
    return { success: true };
  } catch (err) {
    console.error('[FRIENDS] Error removing friend:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get friends list for a user
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (optional: 'accepted', 'pending')
 * @returns {Promise<Array>}
 */
async function getFriendsList(userId, status = 'accepted') {
  if (!isEnabled) return [];
  
  try {
    const userIdLower = userId.toLowerCase();
    
    // Get friendships where user is either user_id or friend_id
    const { data: friendships, error } = await supabase
      .from('friends')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        friend:friend_id (
          player_id,
          username,
          avatar_url,
          elo_rating,
          wallet_address,
          total_games,
          wins,
          last_active
        ),
        user:user_id (
          player_id,
          username,
          avatar_url,
          elo_rating,
          wallet_address,
          total_games,
          wins,
          last_active
        )
      `)
      .or(`and(user_id.eq.${userIdLower},status.eq.${status}),and(friend_id.eq.${userIdLower},status.eq.${status})`);
    
    if (error) throw error;
    
    // Transform to get friend details (not self)
    return (friendships || []).map(f => {
      const friendData = f.user_id === userIdLower ? f.friend : f.user;
      return {
        friendship_id: f.id,
        friend_id: friendData.player_id,
        username: friendData.username,
        avatar_url: friendData.avatar_url,
        elo_rating: friendData.elo_rating,
        wallet_address: friendData.wallet_address,
        total_games: friendData.total_games,
        wins: friendData.wins,
        last_active: friendData.last_active,
        friendship_since: f.created_at,
        status: f.status,
      };
    });
  } catch (err) {
    console.error('[FRIENDS] Error getting friends list:', err.message);
    return [];
  }
}

/**
 * Get pending friend requests (incoming)
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function getPendingFriendRequests(userId) {
  if (!isEnabled) return [];
  
  try {
    const userIdLower = userId.toLowerCase();
    
    const { data: requests, error } = await supabase
      .from('friends')
      .select(`
        id,
        user_id,
        created_at,
        sender:user_id (
          player_id,
          username,
          elo_rating,
          wallet_address
        )
      `)
      .eq('friend_id', userIdLower)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (requests || []).map(r => ({
      friendship_id: r.id,
      sender_id: r.user_id,
      sender_username: r.sender.username,
      sender_elo: r.sender.elo_rating,
      sender_wallet: r.sender.wallet_address,
      created_at: r.created_at,
    }));
  } catch (err) {
    console.error('[FRIENDS] Error getting pending requests:', err.message);
    return [];
  }
}

// ============================================================================
// NOTIFICATIONS MANAGEMENT
// ============================================================================

/**
 * Create a notification
 * @param {Object} notificationData - Notification details
 * @returns {Promise<{success: boolean, notification?: any, error?: string}>}
 */
async function createNotification(notificationData) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const { recipient_id, sender_id, type, data } = notificationData;
    
    if (!recipient_id || !type) {
      return { success: false, error: 'Recipient and type are required' };
    }
    
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: recipient_id.toLowerCase(),
        sender_id: sender_id ? sender_id.toLowerCase() : null,
        type,
        status: 'unread',
        data: data || {},
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[NOTIFICATIONS] Created ${type} notification for ${recipient_id.slice(0, 8)}...`);
    
    return { success: true, notification };
  } catch (err) {
    console.error('[NOTIFICATIONS] Error creating notification:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (optional)
 * @param {number} limit - Limit results
 * @returns {Promise<Array>}
 */
async function getNotifications(userId, status = null, limit = 50) {
  if (!isEnabled) return [];
  
  try {
    const userIdLower = userId.toLowerCase();
    
    let query = supabase
      .from('notifications')
      .select(`
        id,
        recipient_id,
        sender_id,
        type,
        status,
        data,
        created_at,
        read_at,
        sender:sender_id (
          player_id,
          username,
          elo_rating,
          wallet_address
        )
      `)
      .eq('recipient_id', userIdLower)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: notifications, error } = await query;
    
    if (error) throw error;
    
    return (notifications || []).map(n => ({
      id: n.id,
      recipient_id: n.recipient_id,
      sender_id: n.sender_id,
      sender_username: n.sender?.username,
      sender_elo: n.sender?.elo_rating,
      sender_wallet: n.sender?.wallet_address,
      type: n.type,
      status: n.status,
      data: n.data,
      created_at: n.created_at,
      read_at: n.read_at,
    }));
  } catch (err) {
    console.error('[NOTIFICATIONS] Error getting notifications:', err.message);
    return [];
  }
}

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function markNotificationRead(notificationId, userId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', userIdLower);
    
    if (error) throw error;
    
    return { success: true };
  } catch (err) {
    console.error('[NOTIFICATIONS] Error marking notification as read:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update notification status
 * @param {number} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @param {string} newStatus - New status
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function updateNotificationStatus(notificationId, userId, newStatus) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    
    const updateData = { status: newStatus };
    if (newStatus === 'read' || newStatus === 'accepted' || newStatus === 'declined') {
      updateData.read_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', notificationId)
      .eq('recipient_id', userIdLower);
    
    if (error) throw error;
    
    console.log(`[NOTIFICATIONS] Updated notification ${notificationId} status to ${newStatus}`);
    
    return { success: true };
  } catch (err) {
    console.error('[NOTIFICATIONS] Error updating notification status:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
  if (!isEnabled) return 0;
  
  try {
    const userIdLower = userId.toLowerCase();
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userIdLower)
      .eq('status', 'unread');
    
    if (error) throw error;
    
    return count || 0;
  } catch (err) {
    console.error('[NOTIFICATIONS] Error getting unread count:', err.message);
    return 0;
  }
}

/**
 * Delete notification
 * @param {number} notificationId - Notification ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteNotification(notificationId, userId) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const userIdLower = userId.toLowerCase();
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', userIdLower);
    
    if (error) throw error;
    
    return { success: true };
  } catch (err) {
    console.error('[NOTIFICATIONS] Error deleting notification:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Search for players by username or wallet
 * @param {string} searchTerm - Search term
 * @param {number} limit - Limit results
 * @returns {Promise<Array>}
 */
async function searchPlayers(searchTerm, limit = 10) {
  if (!isEnabled) return [];
  
  try {
    const term = searchTerm.trim().toLowerCase();
    
    if (!term || term.length < 2) {
      return [];
    }
    
    const { data: players, error } = await supabase
      .from('players')
      .select('player_id, username, avatar_url, elo_rating, wallet_address, total_games, wins')
      .or(`username.ilike.%${term}%,wallet_address.ilike.%${term}%`)
      .order('elo_rating', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return (players || []).map(normalizePlayer);
  } catch (err) {
    console.error('[SEARCH] Error searching players:', err.message);
    return [];
  }
}

// ============================================================================
// ONLINE STATUS MANAGEMENT
// ============================================================================

/**
 * Set user online status (connected/disconnected)
 * @param {string} walletAddress - User wallet address
 * @param {boolean} isOnline - True if online, false if offline
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setUserOnlineStatus(walletAddress, isOnline) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const playerId = walletAddress.toLowerCase();
    const now = new Date().toISOString();
    
    const updateData = {
      is_online: isOnline,
      last_active: now,
    };
    
    // Update last_seen when going offline
    if (!isOnline) {
      updateData.last_seen = now;
    }
    
    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('player_id', playerId);
    
    if (error) throw error;
    
    console.log(`[ONLINE_STATUS] ${playerId.slice(0, 8)}... → ${isOnline ? 'online' : 'offline'}`);
    
    return { success: true };
  } catch (err) {
    console.error('[ONLINE_STATUS] Error setting online status:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Set user status preference (online, offline, appear_offline)
 * @param {string} walletAddress - User wallet address
 * @param {string} statusPreference - 'online', 'offline', or 'appear_offline'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setUserStatusPreference(walletAddress, statusPreference) {
  if (!isEnabled) return { success: false, error: 'Database not enabled' };
  
  try {
    const playerId = walletAddress.toLowerCase();
    const validStatuses = ['online', 'offline', 'appear_offline'];
    
    if (!validStatuses.includes(statusPreference)) {
      return { success: false, error: 'Invalid status preference' };
    }
    
    const { error } = await supabase
      .from('players')
      .update({
        online_status: statusPreference,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId);
    
    if (error) throw error;
    
    console.log(`[ONLINE_STATUS] ${playerId.slice(0, 8)}... preference → ${statusPreference}`);
    
    return { success: true };
  } catch (err) {
    console.error('[ONLINE_STATUS] Error setting status preference:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get user online status and last seen
 * @param {string} walletAddress - User wallet address
 * @returns {Promise<{is_online: boolean, last_seen: string, online_status: string}>}
 */
async function getUserOnlineStatus(walletAddress) {
  if (!isEnabled) return null;
  
  try {
    const playerId = walletAddress.toLowerCase();
    
    const { data, error } = await supabase
      .from('players')
      .select('is_online, last_seen, online_status')
      .eq('player_id', playerId)
      .single();
    
    if (error) throw error;
    
    return data;
  } catch (err) {
    console.error('[ONLINE_STATUS] Error getting online status:', err.message);
    return null;
  }
}

/**
 * Get list of online users (respecting appear_offline preference)
 * @param {number} limit - Limit results
 * @returns {Promise<Array>}
 */
async function getOnlineUsers(limit = 100) {
  if (!isEnabled) return [];
  
  try {
    const { data, error } = await supabase
      .from('players')
      .select('player_id, username, avatar_url, elo_rating, wallet_address, total_games, wins, is_online, last_seen, online_status')
      .eq('is_online', true)
      .neq('online_status', 'appear_offline') // Exclude users who want to appear offline
      .order('elo_rating', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return (data || []).map(player => ({
      ...normalizePlayer(player),
      online: true,
    }));
  } catch (err) {
    console.error('[ONLINE_STATUS] Error getting online users:', err.message);
    return [];
  }
}

/**
 * Update last seen timestamp (heartbeat)
 * @param {string} walletAddress - User wallet address
 * @returns {Promise<{success: boolean}>}
 */
async function updateLastSeen(walletAddress) {
  if (!isEnabled) return { success: false };
  
  try {
    const playerId = walletAddress.toLowerCase();
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('players')
      .update({
        last_seen: now,
        last_active: now,
      })
      .eq('player_id', playerId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (err) {
    console.error('[ONLINE_STATUS] Error updating last seen:', err.message);
    return { success: false };
  }
}
