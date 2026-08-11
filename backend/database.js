const { Pool } = require('pg');

// Database configuration
// Prefer DATABASE_URL if available (for services like Supabase, Heroku, etc.)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'hemichess',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
      ssl: process.env.DB_HOST && process.env.DB_HOST.includes('supabase') 
        ? { rejectUnauthorized: false }
        : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

// Test connection
pool.on('connect', () => {
  console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err);
});

// Player functions
async function createOrGetPlayer(playerId, username, walletAddress = null) {
  try {
    const result = await pool.query(
      `INSERT INTO players (player_id, username, wallet_address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (player_id) 
       DO UPDATE SET 
         username = $2,
         wallet_address = COALESCE($3, players.wallet_address),
         last_active = CURRENT_TIMESTAMP
       RETURNING *`,
      [playerId, username, walletAddress]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error creating/getting player:', err);
    throw err;
  }
}

async function getPlayerByWalletAddress(walletAddress) {
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE wallet_address = $1',
      [walletAddress.toLowerCase()]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error getting player by wallet:', err);
    return null;
  }
}

async function upsertUserByWallet(walletAddress, username = null) {
  try {
    const displayName = username || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    const playerId = walletAddress.toLowerCase();
    
    const result = await pool.query(
      `INSERT INTO players (player_id, username, wallet_address, last_active)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (player_id)
       DO UPDATE SET
         last_active = CURRENT_TIMESTAMP,
         username = COALESCE($2, players.username)
       RETURNING *`,
      [playerId, displayName, walletAddress.toLowerCase()]
    );
    
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error upserting user by wallet:', err);
    throw err;
  }
}

// NEW: Get user stats by wallet address
async function getUserStatsByWallet(walletAddress) {
  try {
    const result = await pool.query(
      `SELECT 
        player_id,
        username,
        wallet_address,
        elo_rating,
        total_games,
        wins,
        losses,
        draws,
        CASE 
          WHEN total_games > 0 THEN ROUND((wins::NUMERIC / total_games) * 100, 0)
          ELSE 0
        END as win_rate,
        created_at,
        last_active
      FROM players 
      WHERE wallet_address = $1`,
      [walletAddress.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      // Auto-create user if doesn't exist
      return await upsertUserByWallet(walletAddress);
    }
    
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error getting user stats by wallet:', err);
    return null;
  }
}

// NEW: Get match history by wallet address
async function getMatchHistoryByWallet(walletAddress, limit = 10) {
  try {
    const playerId = walletAddress.toLowerCase();
    
    const result = await pool.query(
      `SELECT 
        gh.game_id,
        gh.winner,
        gh.result,
        gh.total_moves,
        gh.completed_at,
        CASE 
          WHEN gh.white_player_id = $1 THEN 'white'
          ELSE 'black'
        END as my_color,
        CASE 
          WHEN gh.winner = 'draw' THEN 'D'
          WHEN (gh.winner = 'white' AND gh.white_player_id = $1) 
            OR (gh.winner = 'black' AND gh.black_player_id = $1) THEN 'W'
          ELSE 'L'
        END as outcome,
        CASE 
          WHEN gh.white_player_id = $1 THEN gh.white_elo_before
          ELSE gh.black_elo_before
        END as elo_before,
        CASE 
          WHEN gh.white_player_id = $1 THEN gh.white_elo_after
          ELSE gh.black_elo_after
        END as elo_after,
        CASE 
          WHEN gh.white_player_id = $1 THEN (gh.white_elo_after - gh.white_elo_before)
          ELSE (gh.black_elo_after - gh.black_elo_before)
        END as elo_change
      FROM game_history gh
      WHERE gh.white_player_id = $1 OR gh.black_player_id = $1
      ORDER BY gh.completed_at DESC
      LIMIT $2`,
      [playerId, limit]
    );
    
    return result.rows;
  } catch (err) {
    console.error('[DB] Error getting match history by wallet:', err);
    return [];
  }
}

// NEW: Record match result (called after on-chain settlement)
async function recordMatchResult(matchData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      gameId,
      whiteAddress,
      blackAddress,
      winner,
      fenString,
      whiteElo,
      blackElo,
      whiteEloAfter,
      blackEloAfter,
      timestamp
    } = matchData;
    
    const whitePlayerId = whiteAddress.toLowerCase();
    const blackPlayerId = blackAddress.toLowerCase();
    
    // Ensure both players exist in database
    await upsertUserByWallet(whiteAddress);
    await upsertUserByWallet(blackAddress);
    
    // Insert game history
    await client.query(
      `INSERT INTO game_history (
        game_id, white_player_id, black_player_id, winner, result,
        total_moves, game_duration, white_elo_before, black_elo_before,
        white_elo_after, black_elo_after, final_fen, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (game_id) DO NOTHING`,
      [
        gameId,
        whitePlayerId,
        blackPlayerId,
        winner,
        'settlement',
        0, // We don't have move count from settlement
        0, // We don't have duration from settlement
        whiteElo,
        blackElo,
        whiteEloAfter,
        blackEloAfter,
        fenString,
        new Date(timestamp * 1000),
        new Date(timestamp * 1000)
      ]
    );
    
    // Update white player stats
    const whiteOutcome = winner === 'white' ? 'win' : winner === 'draw' ? 'draw' : 'loss';
    await updatePlayerStatsAndElo(client, whitePlayerId, whiteOutcome, whiteEloAfter);
    
    // Update black player stats
    const blackOutcome = winner === 'black' ? 'win' : winner === 'draw' ? 'draw' : 'loss';
    await updatePlayerStatsAndElo(client, blackPlayerId, blackOutcome, blackEloAfter);
    
    await client.query('COMMIT');
    console.log(`[DB] ✓ Recorded match result: ${gameId}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Error recording match result:', err);
    return false;
  } finally {
    client.release();
  }
}

// Helper: Update player stats and ELO in one transaction
async function updatePlayerStatsAndElo(client, playerId, outcome, newElo) {
  let winInc = 0, lossInc = 0, drawInc = 0;
  
  if (outcome === 'win') winInc = 1;
  else if (outcome === 'loss') lossInc = 1;
  else if (outcome === 'draw') drawInc = 1;
  
  await client.query(
    `UPDATE players 
     SET 
       elo_rating = $1,
       total_games = total_games + 1,
       wins = wins + $2,
       losses = losses + $3,
       draws = draws + $4,
       updated_at = CURRENT_TIMESTAMP
     WHERE player_id = $5`,
    [newElo, winInc, lossInc, drawInc, playerId]
  );
}

async function getPlayerStats(playerId) {
  try {
    const result = await pool.query(
      'SELECT * FROM player_stats WHERE player_id = $1',
      [playerId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error getting player stats:', err);
    return null;
  }
}

async function updatePlayerElo(playerId, newElo) {
  try {
    await pool.query(
      `UPDATE players 
       SET elo_rating = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE player_id = $2`,
      [newElo, playerId]
    );
  } catch (err) {
    console.error('[DB] Error updating ELO:', err);
  }
}

async function updatePlayerStats(playerId, outcome) {
  try {
    let updateField = '';
    if (outcome === 'win') updateField = 'wins = wins + 1';
    else if (outcome === 'loss') updateField = 'losses = losses + 1';
    else if (outcome === 'draw') updateField = 'draws = draws + 1';

    await pool.query(
      `UPDATE players 
       SET total_games = total_games + 1,
           ${updateField},
           updated_at = CURRENT_TIMESTAMP
       WHERE player_id = $1`,
      [playerId]
    );
  } catch (err) {
    console.error('[DB] Error updating player stats:', err);
  }
}

// Game history functions
async function saveGameHistory(gameData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert game record
    await client.query(
      `INSERT INTO game_history (
        game_id, white_player_id, black_player_id, winner, result,
        total_moves, game_duration, white_elo_before, black_elo_before,
        white_elo_after, black_elo_after, final_fen, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        gameData.gameId,
        gameData.whitePlayerId,
        gameData.blackPlayerId,
        gameData.winner,
        gameData.result,
        gameData.totalMoves,
        gameData.gameDuration,
        gameData.whiteEloBefore,
        gameData.blackEloBefore,
        gameData.whiteEloAfter,
        gameData.blackEloAfter,
        gameData.finalFen,
        gameData.startedAt,
        gameData.completedAt
      ]
    );

    // Insert move history
    if (gameData.moves && gameData.moves.length > 0) {
      const moveValues = gameData.moves.map((move, index) => 
        `('${gameData.gameId}', ${index + 1}, '${move.move}', '${move.fen}', ${move.timeLeft}, '${new Date(move.timestamp).toISOString()}')`
      ).join(',');

      await client.query(
        `INSERT INTO moves (game_id, move_number, move_san, fen, time_left, timestamp) 
         VALUES ${moveValues}`
      );
    }

    // Update player stats
    const whiteOutcome = gameData.winner === 'white' ? 'win' : gameData.winner === 'draw' ? 'draw' : 'loss';
    const blackOutcome = gameData.winner === 'black' ? 'win' : gameData.winner === 'draw' ? 'draw' : 'loss';

    await updatePlayerStats(gameData.whitePlayerId, whiteOutcome);
    await updatePlayerStats(gameData.blackPlayerId, blackOutcome);

    // Update ELO ratings
    await updatePlayerElo(gameData.whitePlayerId, gameData.whiteEloAfter);
    await updatePlayerElo(gameData.blackPlayerId, gameData.blackEloAfter);

    await client.query('COMMIT');
    console.log(`[DB] Saved game history: ${gameData.gameId}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DB] Error saving game history:', err);
    return false;
  } finally {
    client.release();
  }
}

async function getPlayerGameHistory(playerId, limit = 20) {
  try {
    const result = await pool.query(
      'SELECT * FROM get_player_games($1) LIMIT $2',
      [playerId, limit]
    );
    return result.rows;
  } catch (err) {
    console.error('[DB] Error getting game history:', err);
    return [];
  }
}

async function getGameDetails(gameId) {
  try {
    const gameResult = await pool.query(
      `SELECT gh.*, wp.username as white_username, bp.username as black_username
       FROM game_history gh
       JOIN players wp ON gh.white_player_id = wp.player_id
       JOIN players bp ON gh.black_player_id = bp.player_id
       WHERE gh.game_id = $1`,
      [gameId]
    );

    if (gameResult.rows.length === 0) return null;

    const movesResult = await pool.query(
      'SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number',
      [gameId]
    );

    return {
      game: gameResult.rows[0],
      moves: movesResult.rows
    };
  } catch (err) {
    console.error('[DB] Error getting game details:', err);
    return null;
  }
}

// Leaderboard function
async function getLeaderboard(limit = 100) {
  try {
    const result = await pool.query(
      'SELECT * FROM leaderboard LIMIT $1',
      [limit]
    );
    return result.rows;
  } catch (err) {
    console.error('[DB] Error getting leaderboard:', err);
    return [];
  }
}

// Wallet linkage functions (for future Web3 integration)
async function linkWallet(playerId, walletAddress, signature) {
  try {
    await pool.query(
      `INSERT INTO wallet_links (player_id, wallet_address, signature, verified)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (player_id) 
       DO UPDATE SET 
         wallet_address = $2,
         signature = $3,
         linked_at = CURRENT_TIMESTAMP,
         verified = true`,
      [playerId, walletAddress.toLowerCase(), signature]
    );

    await pool.query(
      'UPDATE players SET wallet_address = $1 WHERE player_id = $2',
      [walletAddress.toLowerCase(), playerId]
    );

    console.log(`[DB] Linked wallet ${walletAddress} to player ${playerId}`);
    return true;
  } catch (err) {
    console.error('[DB] Error linking wallet:', err);
    return false;
  }
}

async function getPlayerByWallet(walletAddress) {
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE wallet_address = $1',
      [walletAddress.toLowerCase()]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[DB] Error getting player by wallet:', err);
    return null;
  }
}

// ELO calculation (K-factor based)
function calculateElo(playerElo, opponentElo, outcome) {
  const K = 32; // K-factor (higher = more volatile)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  let actualScore;
  if (outcome === 'win') actualScore = 1;
  else if (outcome === 'draw') actualScore = 0.5;
  else actualScore = 0;
  
  const eloChange = Math.round(K * (actualScore - expectedScore));
  return {
    newElo: playerElo + eloChange,
    change: eloChange
  };
}

module.exports = {
  pool,
  createOrGetPlayer,
  getPlayerStats,
  getPlayerByWalletAddress,
  upsertUserByWallet,
  getUserStatsByWallet,
  getMatchHistoryByWallet,
  recordMatchResult,
  updatePlayerElo,
  updatePlayerStats,
  saveGameHistory,
  getPlayerGameHistory,
  getGameDetails,
  getLeaderboard,
  linkWallet,
  getPlayerByWallet,
  calculateElo
};
