// Load environment variables FIRST
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Chess } = require('chess.js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

// Import match settlement service (blockchain oracle)
const { settleMatch, isSettlementEnabled, getOracleAddress } = require('./services/matchSettlement');

// ELO <-> chain reconciliation (database is the source of truth)
const {
  DEFAULT_ELO,
  SYNC_TOLERANCE,
  readOnChainElo,
  getSyncStatus,
  reconcilePlayer,
  batchReconcilePlayers,
  reconcileInBackground,
  readOracleEthBalance,
} = require('./services/eloSync');

// R2 Storage for avatars
const { isR2Enabled, uploadAvatar, deleteAvatar, getAvatarUrl } = require('./services/r2Storage');


// Backend URL Configuration (Authoritative Source)
const BACKEND_CONFIG_FILE = path.join(__dirname, 'backend-config.json');
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(addr => addr.length > 0);

console.log('[CONFIG] Admin wallets configured:', ADMIN_WALLETS.length > 0 ? ADMIN_WALLETS.map(w => `${w.slice(0, 6)}...${w.slice(-4)}`).join(', ') : 'NONE - Admin features disabled!');

let serverBackendUrl = process.env.BACKEND_URL || 'https://translator-readily-placement-scored.trycloudflare.com';

// Load backend URL from config file if exists
function loadBackendConfig() {
  try {
    if (fs.existsSync(BACKEND_CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(BACKEND_CONFIG_FILE, 'utf8'));
      if (config.backendUrl) {
        serverBackendUrl = config.backendUrl;
        console.log('[CONFIG] Loaded backend URL from file:', serverBackendUrl);
      }
    }
  } catch (err) {
    console.error('[CONFIG] Failed to load backend config:', err.message);
  }
}

// Save backend URL to config file
function saveBackendConfig(url) {
  try {
    const config = { backendUrl: url, lastUpdated: new Date().toISOString() };
    fs.writeFileSync(BACKEND_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    console.log('[CONFIG] Saved backend URL to file:', url);
    return true;
  } catch (err) {
    console.error('[CONFIG] Failed to save backend config:', err.message);
    return false;
  }
}

// Load config on startup
loadBackendConfig();
console.log('[CONFIG] Current backend URL:', serverBackendUrl);

// Try to load Supabase database (uses HTTPS - works everywhere!)
let db = null;
let dbEnabled = false;
try {
  const supabaseDB = require('./supabase');
  if (supabaseDB.isEnabled) {
    db = supabaseDB;
    dbEnabled = true;
    console.log('[DB] Supabase client connected (HTTPS)');
  } else {
    console.log('[DB] Supabase not configured - running without database');
    console.log('[DB] Add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env to enable');
  }
} catch (err) {
  console.log('[DB] Running without database');
  console.log('[DB] To enable: Setup Supabase and add credentials to .env');
}

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for avatar uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeGames: activeGames.size,
    queueSize: matchmakingQueue.length,
    connectedSockets: io.sockets.sockets.size,
    metrics,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Diagnostic endpoint to check environment and database status
app.get('/api/diagnostic', (req, res) => {
  res.json({
    status: 'online',
    version: '4a41ca9-websocket-fix', // Git commit hash for tracking
    timestamp: new Date().toISOString(),
    database: {
      enabled: dbEnabled,
      supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.slice(0, 30)}...` : 'NOT SET',
      supabaseKeyPresent: !!process.env.SUPABASE_SERVICE_KEY,
      supabaseKeyLength: process.env.SUPABASE_SERVICE_KEY?.length || 0
    },
    blockchain: {
      settlementEnabled: isSettlementEnabled(),
      oracleAddress: getOracleAddress()
    },
    storage: {
      r2Enabled: isR2Enabled
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3001,
      nodeVersion: process.version
    }
  });
});

// Test Supabase connection endpoint
app.get('/api/test-supabase', async (req, res) => {
  if (!dbEnabled) {
    return res.json({
      success: false,
      error: 'Database not enabled',
      details: {
        supabaseUrl: process.env.SUPABASE_URL ? 'Present' : 'Missing',
        supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Present' : 'Missing'
      }
    });
  }

  try {
    // Try to query the players table
    const { data, error } = await db.supabase
      .from('players')
      .select('count')
      .limit(1);

    if (error) {
      return res.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
    }

    res.json({
      success: true,
      message: 'Supabase connection successful',
      canQueryDatabase: true
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// Get authoritative backend URL (for all users)
app.get('/api/backend-url', (req, res) => {
  res.json({
    backendUrl: serverBackendUrl,
    lastUpdated: new Date().toISOString()
  });
});

// Update backend URL (admin only)
app.post('/api/backend-url', (req, res) => {
  const { backendUrl, adminWallet } = req.body;
  
  if (!adminWallet || !ADMIN_WALLETS.includes(adminWallet.toLowerCase())) {
    console.log('[ADMIN] ⚠ Unauthorized backend URL update attempt from:', adminWallet || 'unknown');
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  
  if (!backendUrl || typeof backendUrl !== 'string') {
    return res.status(400).json({ error: 'Invalid backend URL' });
  }
  
  const normalizedUrl = backendUrl.trim().replace(/\/+$/, '');
  serverBackendUrl = normalizedUrl;
  
  if (saveBackendConfig(normalizedUrl)) {
    console.log(`[ADMIN] ✓ Backend URL updated by ${adminWallet}: ${normalizedUrl}`);
    res.json({ success: true, backendUrl: normalizedUrl });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// Middleware to verify admin wallet
function verifyAdmin(req, res, next) {
  const adminWallet = req.headers['x-admin-wallet'] || (req.body && req.body.adminWallet) || (req.query && req.query.adminWallet);
  
  if (!adminWallet || !ADMIN_WALLETS.includes(adminWallet.toLowerCase())) {
    console.log('[ADMIN] ⚠ Unauthorized access attempt from:', adminWallet || 'unknown');
    return res.status(403).json({ error: 'Unauthorized: Admin access required' });
  }
  
  next();
}

// Admin endpoint to view active games
app.get('/admin/games', verifyAdmin, (req, res) => {
  const games = [];
  for (const [gameId, gameState] of activeGames.entries()) {
    games.push({
      gameId,
      status: gameState.status,
      whitePlayer: {
        id: gameState.players.white.id.slice(0, 8),
        connected: gameState.players.white.connected
      },
      blackPlayer: {
        id: gameState.players.black.id.slice(0, 8),
        connected: gameState.players.black.connected
      },
      createdAt: new Date(gameState.createdAt).toISOString(),
      lastActivity: new Date(gameState.lastActivity).toISOString()
    });
  }
  res.json({ games, total: games.length });
});

// Admin endpoint to clear all games (emergency)
app.post('/admin/clear-games', verifyAdmin, (req, res) => {
  const count = activeGames.size;
  activeGames.clear();
  console.log(`[ADMIN] Cleared all ${count} games`);
  res.json({ cleared: count });
});

// Admin endpoint to clear completed games
app.post('/admin/clear-completed', verifyAdmin, (req, res) => {
  let cleared = 0;
  for (const [gameId, gameState] of activeGames.entries()) {
    if (gameState.status === 'completed') {
      activeGames.delete(gameId);
      cleared++;
    }
  }
  console.log(`[ADMIN] Cleared ${cleared} completed games`);
  res.json({ cleared });
});

// Admin endpoint to check blockchain sync status
app.get('/admin/blockchain-sync', verifyAdmin, async (req, res) => {
  try {
    let addresses = [];

    if (req.query.addresses) {
      addresses = req.query.addresses.split(',').map(a => a.trim()).filter(Boolean);
    } else if (dbEnabled) {
      const players = await db.listPlayers(100);
      addresses = players.map(p => p.wallet_address).filter(Boolean);
      console.log(`[ADMIN] Checking sync for ${addresses.length} users from database`);
    }

    // getSyncStatus does the DB read + chain read and applies SYNC_TOLERANCE
    const playerSync = await Promise.all(
      addresses.map(async (address) => {
        try {
          const stats = dbEnabled ? await db.getUserStatsByWallet(address) : null;
          const databaseElo = stats?.elo_rating ?? DEFAULT_ELO;
          const status = await getSyncStatus(address, databaseElo);
          return {
            address: address.toLowerCase(),
            onChainElo: status.onChainElo,
            databaseElo,
            totalGames: stats?.total_games ?? 0,
            difference: status.difference,
            inSync: status.inSync,
            needsSync: !status.inSync,
            direction: status.difference > 0 ? 'mint' : status.difference < 0 ? 'burn' : 'none',
          };
        } catch (err) {
          return { address: address.toLowerCase(), error: err.message };
        }
      }),
    );

    const oracleAddress = getOracleAddress();
    const oracleEth = oracleAddress ? await readOracleEthBalance() : '0';

    res.json({
      settlementEnabled: isSettlementEnabled(),
      tolerance: SYNC_TOLERANCE,
      oracleWallet: {
        address: oracleAddress,
        balance: `${oracleEth} ETH`,
        lowBalance: parseFloat(oracleEth) < 0.001,
      },
      playerSync,
      needsSyncCount: playerSync.filter(s => s.needsSync).length,
      totalPlayers: playerSync.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ADMIN] Blockchain sync check failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint to force-sync on-chain balances to the database values.
// Bidirectional: mints when the chain is behind, burns when it is ahead.
app.post('/admin/blockchain-sync', verifyAdmin, async (req, res) => {
  if (!isSettlementEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Settlement service not configured',
      message: 'Add BACKEND_PRIVATE_KEY to backend/.env',
    });
  }

  if (!dbEnabled) {
    return res.status(503).json({ success: false, error: 'Database not enabled' });
  }

  try {
    let { addresses } = req.body || {};

    // No list provided -> sync everyone that is out of sync
    if (!Array.isArray(addresses) || addresses.length === 0) {
      const players = await db.listPlayers(100);
      addresses = players.map(p => p.wallet_address).filter(Boolean);
    }

    if (addresses.length === 0) {
      return res.status(400).json({ success: false, error: 'No addresses to sync' });
    }

    const results = [];

    // Sequential: the oracle wallet uses a single nonce
    for (const address of addresses) {
      try {
        const stats = await db.getUserStatsByWallet(address);
        const databaseElo = stats?.elo_rating ?? DEFAULT_ELO;

        const result = await reconcilePlayer(address, databaseElo);

        results.push({
          address: address.toLowerCase(),
          success: result.success,
          databaseElo,
          onChainBefore: result.onChainBefore ?? result.onChainElo,
          adjustment: result.adjustment ?? 0,
          expectedAfter: databaseElo,
          skipped: !!result.skipped,
          message: result.message,
          txHash: result.txHash,
          error: result.error,
        });
      } catch (err) {
        console.error(`[SYNC] Error syncing ${address}:`, err.message);
        results.push({ address: address.toLowerCase(), success: false, error: err.message });
      }
    }

    const synced = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: failed === 0,
      message: `Synced ${synced} addresses, ${skipped} already in sync, ${failed} failed`,
      results,
      summary: { total: results.length, synced, skipped, failed },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SYNC] Blockchain sync failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// Player history endpoints
app.get('/api/player/:playerId/stats', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  
  try {
    const stats = await db.getUserStatsByWallet(req.params.playerId);
    res.json(stats || { error: 'Player not found' });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update player username
app.post('/api/player/:playerId/username', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    const result = await db.updatePlayerUsername(req.params.playerId, username);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error updating username:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload avatar
app.post('/api/player/:playerId/avatar', upload.single('avatar'), async (req, res) => {
  if (!isR2Enabled) {
    return res.status(503).json({ error: 'Avatar uploads not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const walletAddress = req.params.playerId.toLowerCase();

    // Process image with sharp: resize to 400x400, convert to JPEG, optimize
    const processedImage = await sharp(req.file.buffer)
      .resize(400, 400, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();

    // Upload to R2
    const result = await uploadAvatar(walletAddress, processedImage, 'image/jpeg');

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Update database with avatar URL
    if (dbEnabled) {
      try {
        await db.updatePlayerAvatar(walletAddress, result.url);
      } catch (dbErr) {
        console.error('[API] Failed to update avatar URL in DB:', dbErr);
        // Continue anyway - the image is uploaded
      }
    }

    console.log(`[AVATAR] Uploaded for ${walletAddress.slice(0, 8)}`);
    res.json({ success: true, avatarUrl: result.url });
  } catch (err) {
    console.error('[API] Avatar upload error:', err);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

// Get avatar URL
app.get('/api/player/:playerId/avatar', async (req, res) => {
  try {
    const walletAddress = req.params.playerId.toLowerCase();
    const avatarUrl = getAvatarUrl(walletAddress);

    if (!avatarUrl) {
      return res.status(404).json({ error: 'No avatar found' });
    }

    res.json({ avatarUrl });
  } catch (err) {
    console.error('[API] Get avatar error:', err);
    res.status(500).json({ error: 'Failed to get avatar' });
  }
});

// Delete avatar
app.delete('/api/player/:playerId/avatar', async (req, res) => {
  if (!isR2Enabled) {
    return res.status(503).json({ error: 'Avatar storage not configured' });
  }

  try {
    const walletAddress = req.params.playerId.toLowerCase();

    // Delete from R2
    const result = await deleteAvatar(walletAddress);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Update database to remove avatar URL
    if (dbEnabled) {
      try {
        await db.updatePlayerAvatar(walletAddress, null);
      } catch (dbErr) {
        console.error('[API] Failed to remove avatar URL from DB:', dbErr);
      }
    }

    console.log(`[AVATAR] Deleted for ${walletAddress.slice(0, 8)}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Avatar delete error:', err);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

app.get('/api/player/:playerId/history', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  
  try {
    const limit = parseInt(req.query.limit) || 20;
    const history = await db.getMatchHistoryByWallet(req.params.playerId, limit);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/game/:gameId', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  
  try {
    const gameDetails = await db.getGameDetails(req.params.gameId);
    if (!gameDetails) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(gameDetails);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Wallet linking endpoint (for future Web3)
app.post('/api/link-wallet', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not configured' });
  }
  
  try {
    const { playerId, walletAddress, signature } = req.body;
    
    // TODO: Verify signature with Web3
    // const isValid = await verifySignature(walletAddress, signature);
    // if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    
    const success = await db.linkWallet(playerId, walletAddress, signature);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// User sync endpoint - called when wallet connects
app.post('/api/users/sync', async (req, res) => {
  if (!dbEnabled) {
    // Return success even without DB (graceful degradation)
    return res.json({ 
      success: true, 
      message: 'Database not enabled',
      user: { walletAddress: req.body.walletAddress }
    });
  }
  
  try {
    const { walletAddress, username } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }
    
    const user = await db.upsertUserByWallet(walletAddress, username);
    
    res.json({ 
      success: true, 
      user: {
        playerId: user.player_id,
        username: user.username,
        walletAddress: user.wallet_address,
        elo: user.elo_rating,
        totalGames: user.total_games,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws
      }
    });
  } catch (err) {
    console.error('[API] Error syncing user:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update username endpoint
app.post('/api/users/update-username', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ 
      success: true, 
      message: 'Database not enabled - username stored in browser only'
    });
  }
  
  try {
    const { walletAddress, username } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }
    
    if (username && (username.length < 3 || username.length > 20)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    
    // Update username in database
    const displayName = username || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    const user = await db.upsertUserByWallet(walletAddress, displayName);
    
    res.json({ 
      success: true,
      user: {
        playerId: user.player_id,
        username: user.username,
        walletAddress: user.wallet_address
      }
    });
  } catch (err) {
    console.error('[API] Error updating username:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get total users count
app.get('/api/users/count', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ count: 0, message: 'Database not enabled' });
  }
  
  try {
    const count = await db.countPlayers();
    res.json({ count });
  } catch (err) {
    console.error('[API] Error counting players:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// NEW: Get user stats by wallet address
app.get('/api/users/:address/stats', async (req, res) => {
  if (!dbEnabled) {
    // Return default stats if DB not enabled
    return res.json({
      elo_rating: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      total_games: 0,
      win_rate: 0
    });
  }
  
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const stats = await db.getUserStatsByWallet(address);
    res.json(stats || {
      elo_rating: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      total_games: 0,
      win_rate: 0
    });
  } catch (err) {
    console.error('[API] Error getting user stats:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// NEW: Get match history by wallet address
app.get('/api/users/:address/history', async (req, res) => {
  if (!dbEnabled) {
    // Return empty array if DB not enabled
    return res.json([]);
  }
  
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    const history = await db.getMatchHistoryByWallet(address, limit);
    res.json(history);
  } catch (err) {
    console.error('[API] Error getting match history:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================================
// ONLINE STATUS API ENDPOINTS
// ============================================================================

// Get user online status
app.get('/api/user/:wallet/status', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ 
      is_online: false, 
      online_status: 'offline',
      message: 'Database not enabled' 
    });
  }
  
  try {
    const { wallet } = req.params;
    
    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    const status = await db.getUserOnlineStatus(wallet.toLowerCase());
    res.json(status);
  } catch (err) {
    console.error('[API] Error getting user online status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user status preference (online, appear_offline)
app.post('/api/user/status', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { walletAddress, statusPreference } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    
    if (!statusPreference || !['online', 'offline', 'appear_offline'].includes(statusPreference)) {
      return res.status(400).json({ error: 'Invalid statusPreference' });
    }
    
    const result = await db.setUserStatusPreference(walletAddress.toLowerCase(), statusPreference);
    
    if (result.success) {
      // Broadcast status preference change to all connected clients
      io.emit('user_status_preference_changed', {
        walletAddress: walletAddress.toLowerCase(),
        statusPreference,
        timestamp: Date.now()
      });
      
      res.json({ success: true });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    console.error('[API] Error updating status preference:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Heartbeat endpoint to keep user online
app.post('/api/user/heartbeat', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ success: true, message: 'Database not enabled' });
  }
  
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    
    // Update last_active timestamp
    await db.setUserOnlineStatus(walletAddress.toLowerCase(), true);
    
    res.json({ success: true });
  } catch (err) {
    console.error('[API] Error updating heartbeat:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  if (!dbEnabled) {
    return res.json([]);
  }
  
  try {
    const limit = parseInt(req.query.limit) || 100;
    const minGames = parseInt(req.query.minGames) || 0;
    
    const leaderboard = await db.getLeaderboard(limit, minGames);
    res.json(leaderboard);
  } catch (err) {
    console.error('[API] Error getting leaderboard:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================================
// FRIENDS API ENDPOINTS
// ============================================================================

// Search for players
app.get('/api/players/search', async (req, res) => {
  if (!dbEnabled) {
    return res.json([]);
  }
  
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    const players = await db.searchPlayers(q, 10);
    res.json(players);
  } catch (err) {
    console.error('[API] Error searching players:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Send friend request
app.post('/api/friends/request', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { userId, friendId } = req.body;
    
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }
    
    const result = await db.sendFriendRequest(userId, friendId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Emit WebSocket event to recipient
    const recipientSockets = Array.from(playerSockets.entries())
      .filter(([_, data]) => data.playerId === friendId.toLowerCase())
      .map(([socketId]) => socketId);
    
    if (recipientSockets.length > 0) {
      recipientSockets.forEach(socketId => {
        io.to(socketId).emit('NOTIFICATION_RECEIVED', {
          notification: result.notification,
          type: 'friend_request',
        });
      });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error sending friend request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept friend request
app.post('/api/friends/accept', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { friendshipId, userId } = req.body;
    
    if (!friendshipId || !userId) {
      return res.status(400).json({ error: 'friendshipId and userId are required' });
    }
    
    const result = await db.acceptFriendRequest(friendshipId, userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error accepting friend request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Decline friend request
app.post('/api/friends/decline', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { friendshipId, userId } = req.body;
    
    if (!friendshipId || !userId) {
      return res.status(400).json({ error: 'friendshipId and userId are required' });
    }
    
    const result = await db.declineFriendRequest(friendshipId, userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error declining friend request:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove friend
app.post('/api/friends/remove', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { userId, friendId } = req.body;
    
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'userId and friendId are required' });
    }
    
    const result = await db.removeFriend(userId, friendId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error removing friend:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get friends list
app.get('/api/friends/:userId', async (req, res) => {
  if (!dbEnabled) {
    return res.json([]);
  }
  
  try {
    const { userId } = req.params;
    const status = req.query.status || 'accepted';
    
    const friends = await db.getFriendsList(userId, status);
    res.json(friends);
  } catch (err) {
    console.error('[API] Error getting friends list:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get pending friend requests
app.get('/api/friends/:userId/requests', async (req, res) => {
  if (!dbEnabled) {
    return res.json([]);
  }
  
  try {
    const { userId } = req.params;
    
    const requests = await db.getPendingFriendRequests(userId);
    res.json(requests);
  } catch (err) {
    console.error('[API] Error getting friend requests:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================================
// NOTIFICATIONS API ENDPOINTS
// ============================================================================

// Get notifications
app.get('/api/notifications/:userId', async (req, res) => {
  if (!dbEnabled) {
    return res.json([]);
  }
  
  try {
    const { userId } = req.params;
    const status = req.query.status || null;
    const limit = parseInt(req.query.limit) || 50;
    
    const notifications = await db.getNotifications(userId, status, limit);
    res.json(notifications);
  } catch (err) {
    console.error('[API] Error getting notifications:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get unread count
app.get('/api/notifications/:userId/count', async (req, res) => {
  if (!dbEnabled) {
    return res.json({ count: 0 });
  }
  
  try {
    const { userId } = req.params;
    
    const count = await db.getUnreadCount(userId);
    res.json({ count });
  } catch (err) {
    console.error('[API] Error getting unread count:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Mark notification as read
app.post('/api/notifications/:notificationId/read', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = await db.markNotificationRead(notificationId, userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error marking notification as read:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update notification status
app.post('/api/notifications/:notificationId/status', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { notificationId } = req.params;
    const { userId, status } = req.body;
    
    if (!userId || !status) {
      return res.status(400).json({ error: 'userId and status are required' });
    }
    
    const result = await db.updateNotificationStatus(notificationId, userId, status);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error updating notification status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete notification
app.delete('/api/notifications/:notificationId', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const result = await db.deleteNotification(notificationId, userId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (err) {
    console.error('[API] Error deleting notification:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get online users (for challenges)
app.get('/api/users/online', async (req, res) => {
  try {
    const { excludeUserId } = req.query;
    
    if (dbEnabled) {
      // Query database for online users (source of truth)
      try {
        const { data: onlineUsers, error } = await db.supabase
          .from('players')
          .select('player_id, username, wallet_address, elo_rating, total_games, wins, losses, avatar_url, is_online, online_status')
          .eq('is_online', true);
        
        if (error) throw error;
        
        const filteredPlayers = (onlineUsers || [])
          .filter(user => {
            // Exclude the requesting user
            if (excludeUserId && user.player_id === excludeUserId.toLowerCase()) {
              return false;
            }
            // Respect appear_offline preference
            if (user.online_status === 'appear_offline') {
              return false;
            }
            return true;
          })
          .map(user => ({
            player_id: user.player_id,
            username: user.username || `${user.player_id.slice(0, 6)}...${user.player_id.slice(-4)}`,
            wallet_address: user.wallet_address || user.player_id,
            elo_rating: user.elo_rating || 1200,
            total_games: user.total_games || 0,
            wins: user.wins || 0,
            losses: user.losses || 0,
            avatar_url: user.avatar_url || null,
            online: true,
          }));
        
        // Sort by ELO rating descending
        filteredPlayers.sort((a, b) => b.elo_rating - a.elo_rating);
        
        return res.json({ success: true, players: filteredPlayers, count: filteredPlayers.length });
      } catch (err) {
        console.error('[API] Error querying online users from database:', err);
        // Fall through to in-memory fallback
      }
    }
    
    // Fallback to in-memory playerSockets (when DB is disabled or query fails)
    const onlinePlayers = Array.from(playerSockets.values())
      .filter((data, index, self) => {
        // Deduplicate by playerId (same player can have multiple sockets)
        return self.findIndex(d => d.playerId === data.playerId) === index;
      })
      .filter(data => {
        // Exclude the requesting user
        return !excludeUserId || data.playerId !== excludeUserId.toLowerCase();
      })
      .map(data => ({
        player_id: data.playerId,
        username: data.playerName || `${data.playerId.slice(0, 6)}...${data.playerId.slice(-4)}`,
        wallet_address: data.playerId,
        online: true,
        elo_rating: 1200,
        total_games: 0,
        wins: 0,
        losses: 0,
        avatar_url: null,
      }));
    
    res.json({ success: true, players: onlinePlayers, count: onlinePlayers.length });
  } catch (err) {
    console.error('[API] Error getting online users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get active/live games (for spectating)
app.get('/api/games/live', async (req, res) => {
  try {
    const liveGames = [];
    
    for (const [gameId, gameState] of activeGames.entries()) {
      // Only show active (ongoing) games, not completed ones
      if (gameState.status === 'active') {
        liveGames.push({
          gameId,
          whitePlayer: {
            name: gameState.players.white.name || 'Player',
            elo: gameState.players.white.elo || 1200,
            walletAddress: gameState.players.white.walletAddress,
          },
          blackPlayer: {
            name: gameState.players.black.name || 'Player',
            elo: gameState.players.black.elo || 1200,
            walletAddress: gameState.players.black.walletAddress,
          },
          spectatorCount: gameState.spectators.size,
          moveCount: gameState.moveHistory.length,
          createdAt: gameState.createdAt,
          isRanked: gameState.isRanked !== false, // Default true if not specified
          isFriendMatch: gameState.isFriendMatch || false,
        });
      }
    }
    
    // Sort by most recent first
    liveGames.sort((a, b) => b.createdAt - a.createdAt);
    
    res.json({ success: true, games: liveGames, count: liveGames.length });
  } catch (err) {
    console.error('[API] Error getting live games:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send match challenge
app.post('/api/challenge/send', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({ error: 'Database not enabled' });
  }
  
  try {
    const { challengerId, opponentId, timeControl } = req.body;
    
    if (!challengerId || !opponentId) {
      return res.status(400).json({ error: 'challengerId and opponentId are required' });
    }
    
    // Check if challenger is online
    const challengerSockets = Array.from(playerSockets.entries())
      .filter(([_, data]) => data.playerId === challengerId.toLowerCase())
      .map(([socketId]) => socketId);
    
    if (challengerSockets.length === 0) {
      return res.status(400).json({ error: 'You must be online to send a challenge' });
    }
    
    // Generate unique challenge ID FIRST
    const challengeId = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create notification
    const result = await db.createNotification({
      recipient_id: opponentId,
      sender_id: challengerId,
      type: 'match_challenge',
      data: { time_control: timeControl || 600000, challenge_id: challengeId },
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    // Track challenge state
    activeChallenges.set(challengeId, {
      challengeId,
      challengerId: challengerId.toLowerCase(),
      opponentId: opponentId.toLowerCase(),
      notificationId: result.notification.id,
      timeControl: timeControl || 600000,
      status: 'pending',
      createdAt: Date.now(),
    });
    
    // Track player challenges
    if (!playerChallenges.has(challengerId.toLowerCase())) {
      playerChallenges.set(challengerId.toLowerCase(), new Set());
    }
    playerChallenges.get(challengerId.toLowerCase()).add(challengeId);
    
    // Set 60-second expiration timer
    const timer = setTimeout(async () => {
      const challenge = activeChallenges.get(challengeId);
      if (challenge && challenge.status === 'pending') {
        console.log(`[CHALLENGE] Challenge ${challengeId} expired`);
        
        // Mark notification as expired
        if (dbEnabled) {
          await db.updateNotificationStatus(challenge.notificationId, opponentId, 'expired');
        }
        
        // Emit expiration to both users
        const challengerSockets = Array.from(playerSockets.entries())
          .filter(([_, data]) => data.playerId === challengerId.toLowerCase())
          .map(([socketId]) => socketId);
        
        const opponentSockets = Array.from(playerSockets.entries())
          .filter(([_, data]) => data.playerId === opponentId.toLowerCase())
          .map(([socketId]) => socketId);
        
        challengerSockets.forEach(socketId => {
          io.to(socketId).emit('CHALLENGE_EXPIRED', {
            challengeId,
            reason: 'No response',
          });
        });
        
        opponentSockets.forEach(socketId => {
          io.to(socketId).emit('CHALLENGE_EXPIRED', {
            challengeId,
            notificationId: challenge.notificationId,
          });
        });
        
        // Cleanup
        activeChallenges.delete(challengeId);
        challengeTimers.delete(challengeId);
        playerChallenges.get(challengerId.toLowerCase())?.delete(challengeId);
      }
    }, 60000); // 60 seconds
    
    challengeTimers.set(challengeId, timer);
    
    // Emit WebSocket event to opponent
    const opponentSockets = Array.from(playerSockets.entries())
      .filter(([_, data]) => data.playerId === opponentId.toLowerCase())
      .map(([socketId]) => socketId);
    
    if (opponentSockets.length > 0) {
      opponentSockets.forEach(socketId => {
        io.to(socketId).emit('CHALLENGE_RECEIVED', {
          challengeId,
          notification: result.notification,
          challenger_id: challengerId,
          time_control: timeControl || 600000,
        });
      });
    }
    
    res.json({ success: true, challengeId, notification: result.notification });
  } catch (err) {
    console.error('[API] Error sending challenge:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Settlement status endpoint - check if blockchain settlement is enabled
app.get('/api/settlement/status', (req, res) => {
  const enabled = isSettlementEnabled();
  const oracleAddress = getOracleAddress();
  
  res.json({
    enabled,
    oracleAddress,
    message: enabled 
      ? 'Blockchain settlement enabled' 
      : 'BACKEND_PRIVATE_KEY not configured - settlement disabled'
  });
});

// Match settlement endpoint - Backend Oracle
app.post('/api/settlement/settle-match', async (req, res) => {
  if (!isSettlementEnabled()) {
    return res.status(503).json({ 
      success: false,
      error: 'Settlement service not configured',
      message: 'Add BACKEND_PRIVATE_KEY to backend/.env to enable on-chain settlement'
    });
  }

  try {
    const {
      gameId,
      whiteAddress,
      blackAddress,
      whiteElo,
      blackElo,
      winner,
      fenString,
      whiteSignature,
      blackSignature,
      timestamp,
    } = req.body;

    // Validate required fields
    if (!gameId || !whiteAddress || !blackAddress || !winner || !fenString || !whiteSignature || !blackSignature || !timestamp) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields',
        required: ['gameId', 'whiteAddress', 'blackAddress', 'whiteElo', 'blackElo', 'winner', 'fenString', 'whiteSignature', 'blackSignature', 'timestamp']
      });
    }

    // Validate addresses are valid Ethereum addresses
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(whiteAddress) || !addressRegex.test(blackAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address format'
      });
    }

    // Validate signatures are valid hex strings
    const signatureRegex = /^0x[a-fA-F0-9]{130}$/;
    if (!signatureRegex.test(whiteSignature) || !signatureRegex.test(blackSignature)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signature format'
      });
    }

    // Validate winner value
    if (!['white', 'black', 'draw'].includes(winner)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid winner value. Must be "white", "black", or "draw"'
      });
    }

    // Validate Elo values
    if (typeof whiteElo !== 'number' || typeof blackElo !== 'number' || whiteElo < 0 || blackElo < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Elo values. Must be positive numbers'
      });
    }

    // Validate timestamp is recent (within last hour)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 3600) {
      return res.status(400).json({
        success: false,
        error: 'Timestamp too old or in future. Must be within last hour'
      });
    }

    // Settle the match on-chain
    const result = await settleMatch({
      gameId,
      whiteAddress,
      blackAddress,
      whiteElo: whiteElo || DEFAULT_ELO,
      blackElo: blackElo || DEFAULT_ELO,
      winner,
      fenString,
      whiteSignature,
      blackSignature,
      timestamp,
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Match settled on-chain',
        whiteResult: result.whiteResult,
        blackResult: result.blackResult,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Settlement failed',
      });
    }
  } catch (err) {
    console.error('[API] Settlement error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // We will restrict this in production
    methods: ["GET", "POST"]
  },
  // Fast connection detection for local dev
  pingTimeout: 5000,      // 5 seconds (was 60s)
  pingInterval: 2000,     // 2 seconds (was 25s)
  connectTimeout: 10000,  // 10 seconds max for initial connection
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling']
});

// Game state management
const activeGames = new Map(); // gameId -> gameState
const playerSockets = new Map(); // socketId -> playerInfo
const matchmakingQueue = []; // Players waiting for a match
const walletToGame = new Map(); // walletAddress -> gameId
const disconnectTimers = new Map(); // walletAddress -> timeoutId

// Challenge management
const activeChallenges = new Map(); // challengeId -> challengeState
const challengeTimers = new Map(); // challengeId -> timeoutId
const playerChallenges = new Map(); // playerId -> Set of challengeIds

// Performance metrics
const metrics = {
  totalGamesCreated: 0,
  totalGamesCompleted: 0,
  peakConcurrentGames: 0,
  peakQueueSize: 0,
  totalMoves: 0
};

// Update metrics
function updateMetrics() {
  const currentGames = activeGames.size;
  const currentQueue = matchmakingQueue.length;
  
  if (currentGames > metrics.peakConcurrentGames) {
    metrics.peakConcurrentGames = currentGames;
  }
  
  if (currentQueue > metrics.peakQueueSize) {
    metrics.peakQueueSize = currentQueue;
  }
}

// Log server stats every minute
setInterval(() => {
  console.log('\n========== SERVER STATS ==========');
  console.log(`Active Games: ${activeGames.size}`);
  console.log(`Queue Size: ${matchmakingQueue.length}`);
  console.log(`Connected Sockets: ${io.sockets.sockets.size}`);
  console.log(`Total Games Created: ${metrics.totalGamesCreated}`);
  console.log(`Total Games Completed: ${metrics.totalGamesCompleted}`);
  console.log(`Peak Concurrent Games: ${metrics.peakConcurrentGames}`);
  console.log(`Peak Queue Size: ${metrics.peakQueueSize}`);
  console.log(`Total Moves: ${metrics.totalMoves}`);
  console.log(`Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log('==================================\n');
}, 60000); // Every 1 minute

// Game State Structure
function createGameState(gameId, whitePlayerId, blackPlayerId, timeControlMs = 600000) {
  const initialTime = typeof timeControlMs === 'number' && timeControlMs > 0 ? timeControlMs : 600000;
  return {
    gameId,
    game: new Chess(),
    timeControl: initialTime,
    players: {
      white: {
        id: whitePlayerId,
        name: null,
        walletAddress: null,
        socketId: null,
        connected: false,
        timeLeft: initialTime,
        lastMoveTime: Date.now(),
        elo: DEFAULT_ELO
      },
      black: {
        id: blackPlayerId,
        name: null,
        walletAddress: null,
        socketId: null,
        connected: false,
        timeLeft: initialTime,
        lastMoveTime: Date.now(),
        elo: DEFAULT_ELO
      }
    },
    spectators: new Set(),
    status: 'active', // active, paused, completed
    result: null, // { winner: 'white'|'black'|'draw', reason: string }
    moveHistory: [],
    drawOffer: null, // 'white' or 'black' if pending
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

// Active game clock monitoring (Flag fall / timeout detection)
setInterval(() => {
  const now = Date.now();
  for (const [gameId, gameState] of activeGames.entries()) {
    if (gameState.status === 'active' && gameState.game && gameState.players) {
      const currentTurn = gameState.game.turn(); // 'w' or 'b'
      const activeColor = currentTurn === 'w' ? 'white' : 'black';
      const opponentColor = currentTurn === 'w' ? 'black' : 'white';
      const activePlayer = gameState.players[activeColor];
      
      // Only deduct time if at least one move has occurred or both players are connected
      if (activePlayer && activePlayer.lastMoveTime && (gameState.moveHistory.length > 0 || (gameState.players.white.connected && gameState.players.black.connected))) {
        const elapsed = now - activePlayer.lastMoveTime;
        const currentRemaining = activePlayer.timeLeft - elapsed;
        
        if (currentRemaining <= 0) {
          activePlayer.timeLeft = 0;
          gameState.status = 'completed';
          const winner = opponentColor;
          const reason = 'timeout';
          gameState.result = { winner, reason };
          metrics.totalGamesCompleted++;
          
          console.log(`[TIMEOUT] Game ${gameId}: ${activeColor} timed out. ${winner} wins!`);
          
          io.to(gameId).emit('game_over', {
            winner,
            reason,
            finalFen: gameState.game.fen()
          });
          
          handleGameSettlement(gameState);
        }
      }
    }
  }
}, 1000);

// Function to match two players from queue
async function tryMatchPlayers() {
  // Match multiple pairs if queue is large enough
  while (matchmakingQueue.length >= 2) {
    const player1 = matchmakingQueue.shift();
    const player2 = matchmakingQueue.shift();

    const timeControl = player1.timeControl || player2.timeControl || 600000;

    // Randomly assign colors
    const [whitePlayer, blackPlayer] = Math.random() < 0.5 
      ? [player1, player2] 
      : [player2, player1];

    const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const gameState = createGameState(gameId, whitePlayer.playerId, blackPlayer.playerId, timeControl);

    gameState.players.white.socketId = whitePlayer.socketId;
    gameState.players.white.connected = true;
    gameState.players.white.name = whitePlayer.playerName;
    gameState.players.white.walletAddress = whitePlayer.walletAddress;
    gameState.players.black.socketId = blackPlayer.socketId;
    gameState.players.black.connected = true;
    gameState.players.black.name = blackPlayer.playerName;
    gameState.players.black.walletAddress = blackPlayer.walletAddress;

    // Track wallet to game mapping
    if (whitePlayer.walletAddress) {
      walletToGame.set(whitePlayer.walletAddress.toLowerCase(), gameId);
    }
    if (blackPlayer.walletAddress) {
      walletToGame.set(blackPlayer.walletAddress.toLowerCase(), gameId);
    }

    // Initialize ELO ratings from database (MUST happen before emitting game_found)
    await initializePlayerElo(gameState);

    activeGames.set(gameId, gameState);
    metrics.totalGamesCreated++;
    updateMetrics();

    // Join both players to game room
    const whiteSocket = io.sockets.sockets.get(whitePlayer.socketId);
    const blackSocket = io.sockets.sockets.get(blackPlayer.socketId);
    
    if (whiteSocket) whiteSocket.join(gameId);
    if (blackSocket) blackSocket.join(gameId);

    // Fetch avatars for both players (BEFORE emitting events)
    let whiteAvatarUrl = null;
    if (whitePlayer.walletAddress && dbEnabled) {
      const whiteStats = await db.getUserStatsByWallet(whitePlayer.walletAddress);
      whiteAvatarUrl = whiteStats?.avatar_url || null;
    }
    
    let blackAvatarUrl = null;
    if (blackPlayer.walletAddress && dbEnabled) {
      const blackStats = await db.getUserStatsByWallet(blackPlayer.walletAddress);
      blackAvatarUrl = blackStats?.avatar_url || null;
    }

    // Notify both players with ELO data, avatar URLs, and exact time control
    if (whiteSocket) {
      whiteSocket.emit('game_found', {
        gameId,
        color: 'white',
        opponent: { 
          name: blackPlayer.playerName,
          elo: gameState.players.black.elo || DEFAULT_ELO,
          avatar: blackAvatarUrl
        },
        fen: gameState.game.fen(),
        timeLeft: gameState.players.white.timeLeft,
        opponentTimeLeft: gameState.players.black.timeLeft,
        myElo: gameState.players.white.elo || DEFAULT_ELO,
        myAvatar: whiteAvatarUrl,
        timeControl
      });
    }

    if (blackSocket) {
      blackSocket.emit('game_found', {
        gameId,
        color: 'black',
        opponent: { 
          name: whitePlayer.playerName,
          elo: gameState.players.white.elo || DEFAULT_ELO,
          avatar: whiteAvatarUrl
        },
        fen: gameState.game.fen(),
        timeLeft: gameState.players.black.timeLeft,
        opponentTimeLeft: gameState.players.white.timeLeft,
        myElo: gameState.players.black.elo || DEFAULT_ELO,
        myAvatar: blackAvatarUrl,
        timeControl
      });
    }

    console.log(`✓ Match #${metrics.totalGamesCreated}: ${whitePlayer.playerName} (W) vs ${blackPlayer.playerName} (B) [${timeControl / 60000}m]`);
  }
  
  console.log(`Queue: ${matchmakingQueue.length} | Active Games: ${activeGames.size}`);
}

// Initialize player ELO ratings from DATABASE (not blockchain)
// Database is now the source of truth for display/matchmaking
async function initializePlayerElo(gameState) {
  try {
    const db = require('./supabase');
    
    if (!db.isEnabled) {
      // Fallback to default if database not available
      gameState.players.white.elo = 1200;
      gameState.players.black.elo = 1200;
      return;
    }
    
    // Read from database for both players
    if (gameState.players.white.walletAddress) {
      const whiteStats = await db.getUserStatsByWallet(gameState.players.white.walletAddress);
      gameState.players.white.elo = whiteStats?.elo_rating || 1200;
      console.log(`[ELO] White (${gameState.players.white.walletAddress.slice(0, 8)}...): ${gameState.players.white.elo} ELO (from database)`);
    }
    
    if (gameState.players.black.walletAddress) {
      const blackStats = await db.getUserStatsByWallet(gameState.players.black.walletAddress);
      gameState.players.black.elo = blackStats?.elo_rating || 1200;
      console.log(`[ELO] Black (${gameState.players.black.walletAddress.slice(0, 8)}...): ${gameState.players.black.elo} ELO (from database)`);
    }
  } catch (err) {
    console.error('[ELO] Error initializing ELO from database:', err);
    // Fall back to default if read fails
    if (!gameState.players.white.elo) gameState.players.white.elo = 1200;
    if (!gameState.players.black.elo) gameState.players.black.elo = 1200;
  }
}

// Ensure the player is eligible to play and their chain balance tracks the DB.
//
// Rules:
//  - Every wallet gets a database profile with 1200 ELO on first sight.
//  - A player is NEVER blocked because their rating dropped (losing below 1200
//    used to lock people out of matchmaking - that was a bug).
//  - Chain reconciliation happens in the background and never blocks the queue.
async function verifyPlayerHasHelo(walletAddress, playerName) {
  if (!walletAddress) return false;

  try {
    if (dbEnabled) {
      // getUserStatsByWallet auto-creates the profile at DEFAULT_ELO
      const stats = await db.getUserStatsByWallet(walletAddress);

      if (stats) {
        const dbElo = stats.elo_rating ?? DEFAULT_ELO;
        console.log(`[GATEKEEPER] ${walletAddress.slice(0, 8)}... has ${dbElo} ELO in database`);

        // Reconcile the chain in the background (mint on first game, repair
        // any drift from a failed settlement afterwards).
        if (isSettlementEnabled()) {
          reconcileInBackground(walletAddress, dbElo, 'matchmaking');
        }

        return true;
      }
    }

    // Fallback: no database - fall back to the chain balance
    const chainElo = await readOnChainElo(walletAddress);
    console.log(`[GATEKEEPER] ${walletAddress.slice(0, 8)}... has ${chainElo.toFixed(0)} $HELO on-chain (no DB)`);
    return chainElo > 0;
  } catch (err) {
    console.error('[GATEKEEPER] Error verifying player:', err.message);
    // Database is the gate; a transient RPC/DB hiccup shouldn't block play
    return dbEnabled;
  }
}


// Save completed game to database
async function saveGameToDatabase(gameState) {
  // NOTE: Game history is now saved in handleGameSettlement via recordMatchResult
  // This function is kept for backwards compatibility but does nothing
  console.log('[DB] Game history saved via handleGameSettlement (not here)');
  return;
  
  /* OLD CODE - DISABLED
  if (!dbEnabled || !db) return;
  
  try {
    // Calculate ELO changes
    const whiteEloBefore = gameState.players.white.elo || 200;
    const blackEloBefore = gameState.players.black.elo || 200;
    
    let whiteOutcome, blackOutcome;
    if (gameState.result.winner === 'white') {
      whiteOutcome = 'win';
      blackOutcome = 'loss';
    } else if (gameState.result.winner === 'black') {
      whiteOutcome = 'loss';
      blackOutcome = 'win';
    } else {
      whiteOutcome = 'draw';
      blackOutcome = 'draw';
    }
    
    const whiteEloChange = db.calculateElo(whiteEloBefore, blackEloBefore, whiteOutcome);
    const blackEloChange = db.calculateElo(blackEloBefore, whiteEloBefore, blackOutcome);
    
    // Prepare game data
    const gameDuration = Math.floor((Date.now() - gameState.createdAt) / 1000);
    
    const gameData = {
      gameId: gameState.gameId,
      whitePlayerId: gameState.players.white.id,
      blackPlayerId: gameState.players.black.id,
      winner: gameState.result.winner,
      result: gameState.result.reason,
      totalMoves: gameState.moveHistory.length,
      gameDuration,
      whiteEloBefore,
      blackEloBefore,
      whiteEloAfter: whiteEloChange.newElo,
      blackEloAfter: blackEloChange.newElo,
      finalFen: gameState.game.fen(),
      startedAt: new Date(gameState.createdAt),
      completedAt: new Date(),
      moves: gameState.moveHistory
    };
    
    await db.saveGameHistory(gameData);
    console.log(`[DB] ✓ Saved game ${gameState.gameId} (W: ${whiteEloChange.change >= 0 ? '+' : ''}${whiteEloChange.change}, B: ${blackEloChange.change >= 0 ? '+' : ''}${blackEloChange.change})`);
  } catch (err) {
    console.error('[DB] Error saving game:', err);
  }
  */
}

// Handle game settlement (NO PLAYER SIGNATURES)
//
// Order of operations (database-first, chain reconciles towards it):
//   1. Write the result to the database -> authoritative new ELO + W/L/D
//   2. Emit `elo_updated` immediately so the UI is instant
//   3. Reconcile each player's on-chain $HELO balance towards the database
//      value (mint or burn the exact difference). This is self-healing: if a
//      transaction failed in a previous game, the next reconcile fixes it.
async function handleGameSettlement(gameState) {
  const whiteAddress = gameState.players.white.walletAddress;
  const blackAddress = gameState.players.black.walletAddress;

  if (!whiteAddress || !blackAddress) {
    console.log('[SETTLEMENT] ⚠ Missing wallet addresses, skipping settlement');
    return;
  }

  const whiteEloBefore = gameState.players.white.elo || DEFAULT_ELO;
  const blackEloBefore = gameState.players.black.elo || DEFAULT_ELO;

  console.log(`\n[SETTLEMENT] ========== Settling Game ${gameState.gameId} ==========`);
  console.log(`[SETTLEMENT] White: ${whiteAddress.slice(0, 8)}... (${whiteEloBefore} ELO)`);
  console.log(`[SETTLEMENT] Black: ${blackAddress.slice(0, 8)}... (${blackEloBefore} ELO)`);
  console.log(`[SETTLEMENT] Result: ${gameState.result.winner} by ${gameState.result.reason}`);

  io.to(gameState.gameId).emit('settlement_pending', {
    message: 'Recording result...',
  });

  // ---------- STEP 1: database (source of truth) ----------
  let dbResult = { success: false };

  try {
    if (dbEnabled) {
      dbResult = await db.recordMatchResult({
        gameId: gameState.gameId,
        whiteAddress,
        blackAddress,
        winner: gameState.result.winner,
        fenString: (gameState.game && gameState.game.fen()) || gameState.fen || '',
        whiteElo: whiteEloBefore,
        blackElo: blackEloBefore,
        totalMoves: gameState.moveHistory ? gameState.moveHistory.length : 0,
        gameDuration: gameState.createdAt
          ? Math.floor((Date.now() - gameState.createdAt) / 1000)
          : 0,
        result: gameState.result.reason,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  } catch (dbErr) {
    console.error('[SETTLEMENT] ✗ Database write failed:', dbErr.message);
    dbResult = { success: false, error: dbErr.message };
  }

  if (!dbResult.success) {
    io.to(gameState.gameId).emit('settlement_error', {
      error: dbResult.error || 'Failed to record result',
    });
    console.error('[SETTLEMENT] ✗ Aborting - result was not recorded');
    return;
  }

  if (dbResult.alreadyRecorded) {
    console.log('[SETTLEMENT] ↺ Game already settled - not applying again');
    return;
  }

  const whiteEloAfter = dbResult.whiteEloAfter;
  const blackEloAfter = dbResult.blackEloAfter;

  // Keep in-memory state aligned with the database
  gameState.players.white.elo = whiteEloAfter;
  gameState.players.black.elo = blackEloAfter;

  // ---------- STEP 2: instant UI update ----------
  io.to(gameState.gameId).emit('elo_updated', {
    whiteElo: whiteEloAfter,
    blackElo: blackEloAfter,
    whiteChange: dbResult.whiteChange,
    blackChange: dbResult.blackChange,
  });
  console.log(
    `[SETTLEMENT] ✓ Database updated (W: ${whiteEloBefore}→${whiteEloAfter}, B: ${blackEloBefore}→${blackEloAfter})`,
  );

  // ---------- STEP 3: reconcile the chain towards the database ----------
  if (!isSettlementEnabled()) {
    console.log('[SETTLEMENT] ⚠ On-chain settlement disabled - BACKEND_PRIVATE_KEY not configured');
    io.to(gameState.gameId).emit('settlement_complete', {
      success: true,
      onChain: false,
      gameId: gameState.gameId,
      whiteAddress,
      blackAddress,
      whiteResult: { oldElo: whiteEloBefore, newElo: whiteEloAfter, change: dbResult.whiteChange },
      blackResult: { oldElo: blackEloBefore, newElo: blackEloAfter, change: dbResult.blackChange },
    });
    return;
  }

  try {
    io.to(gameState.gameId).emit('settlement_pending', {
      message: 'Syncing $HELO on-chain...',
    });

    // reconcilePlayer diffs the live chain balance against the DB value, so a
    // previously failed mint/burn is repaired here automatically.
    const [whiteSync, blackSync] = await Promise.all([
      reconcilePlayer(whiteAddress, whiteEloAfter),
      reconcilePlayer(blackAddress, blackEloAfter),
    ]);

    const onChainOk = whiteSync.success && blackSync.success;

    io.to(gameState.gameId).emit('settlement_complete', {
      success: true,
      onChain: onChainOk,
      gameId: gameState.gameId,
      whiteAddress,
      blackAddress,
      whiteResult: {
        oldElo: whiteEloBefore,
        newElo: whiteEloAfter,
        change: dbResult.whiteChange,
        txHash: whiteSync.txHash || null,
        onChainError: whiteSync.error || null,
      },
      blackResult: {
        oldElo: blackEloBefore,
        newElo: blackEloAfter,
        change: dbResult.blackChange,
        txHash: blackSync.txHash || null,
        onChainError: blackSync.error || null,
      },
    });

    console.log(
      onChainOk
        ? '[SETTLEMENT] ✓ On-chain balances reconciled'
        : '[SETTLEMENT] ⚠ On-chain reconcile incomplete (admin sync can repair it)',
    );
    console.log(`[SETTLEMENT] ==========================================\n`);
  } catch (err) {
    console.error('[SETTLEMENT] ✗ Exception during on-chain reconcile:', err);
    // The database is already correct; surface a soft warning only.
    io.to(gameState.gameId).emit('settlement_complete', {
      success: true,
      onChain: false,
      gameId: gameState.gameId,
      whiteAddress,
      blackAddress,
      error: err.message || 'On-chain sync failed (rating is safe in the database)',
      whiteResult: { oldElo: whiteEloBefore, newElo: whiteEloAfter, change: dbResult.whiteChange },
      blackResult: { oldElo: blackEloBefore, newElo: blackEloAfter, change: dbResult.blackChange },
    });
  }
}


io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id} (Total: ${io.sockets.sockets.size})`);

  // Register player as online (for friends/challenges)
  socket.on('register_player', async ({ walletAddress, playerName }) => {
    if (!walletAddress) return;
    
    const playerId = walletAddress.toLowerCase();
    const effectiveName = playerName || `${playerId.slice(0, 6)}...${playerId.slice(-4)}`;
    
    playerSockets.set(socket.id, {
      playerId,
      walletAddress,
      playerName: effectiveName,
      joinedAt: Date.now()
    });
    
    // Update database online status
    if (dbEnabled) {
      await db.setUserOnlineStatus(playerId, true);
      
      // Broadcast status update to all connected clients
      io.emit('user_status_changed', {
        walletAddress: playerId,
        is_online: true,
        timestamp: Date.now()
      });
    }
    
    console.log(`[REGISTER] ${effectiveName} registered as online (socket: ${socket.id})`);
  });

  // Check for active session on connection
  socket.on('check_active_session', async ({ walletAddress }) => {
    if (!walletAddress) return;
    
    const walletLower = walletAddress.toLowerCase();
    const gameId = walletToGame.get(walletLower);
    
    if (gameId && activeGames.has(gameId)) {
      const gameState = activeGames.get(gameId);
      const color = gameState.players.white.walletAddress?.toLowerCase() === walletLower ? 'white' : 'black';
      const otherColor = color === 'white' ? 'black' : 'white';
      
      // Clear disconnect timer if exists
      if (disconnectTimers.has(walletLower)) {
        clearTimeout(disconnectTimers.get(walletLower));
        disconnectTimers.delete(walletLower);
        console.log(`[TIMER] Cleared disconnect timer for ${walletLower.slice(0, 8)}`);
      }
      
      // Update player connection
      gameState.players[color].socketId = socket.id;
      gameState.players[color].connected = true;
      socket.join(gameId);
      
      // Fetch avatar URLs for both players
      let myAvatarUrl = null;
      let opponentAvatarUrl = null;
      
      if (dbEnabled) {
        if (gameState.players[color].walletAddress) {
          const myStats = await db.getUserStatsByWallet(gameState.players[color].walletAddress);
          myAvatarUrl = myStats?.avatar_url || null;
        }
        
        if (gameState.players[otherColor].walletAddress) {
          const oppStats = await db.getUserStatsByWallet(gameState.players[otherColor].walletAddress);
          opponentAvatarUrl = oppStats?.avatar_url || null;
        }
      }
      
      // Restore game session
      socket.emit('game_restored', {
        gameId,
        fen: gameState.game.fen(),
        color,
        whiteTimeLeft: gameState.players.white.timeLeft,
        blackTimeLeft: gameState.players.black.timeLeft,
        moveHistory: gameState.moveHistory,
        opponentName: gameState.players[otherColor].name,
        opponentElo: gameState.players[otherColor].elo || DEFAULT_ELO,
        opponentAvatar: opponentAvatarUrl,
        myElo: gameState.players[color].elo || DEFAULT_ELO,
        myAvatar: myAvatarUrl,
        drawOffer: gameState.drawOffer
      });
      
      // Notify opponent
      io.to(gameId).emit('opponent_reconnected', { color });
      
      console.log(`[RESTORE] ${walletLower.slice(0, 8)} restored session in game ${gameId} as ${color}`);
    }
  });

  // Join matchmaking queue
  socket.on('find_match', async (playerData) => {
    const { playerId, playerName, walletAddress, timeControl } = playerData || {};
    
    // Use wallet address as primary identifier if provided
    const effectivePlayerId = walletAddress ? walletAddress.toLowerCase() : playerId;
    const effectiveName = playerName || `${effectivePlayerId ? `${effectivePlayerId.slice(0, 6)}...${effectivePlayerId.slice(-4)}` : 'Player'}`;
    
    console.log(`[MATCH] Player ${effectiveName} (${effectivePlayerId.slice(0, 8)}) requesting match`);
    
    // NEW: Web3 Gatekeeper - Verify player has claimed $HELO
    if (walletAddress) {
      const hasHelo = await verifyPlayerHasHelo(walletAddress);
      if (!hasHelo) {
        console.log(`[GATEKEEPER] ✗ Rejected ${effectiveName} - No $HELO balance`);
        socket.emit('matchmaking_rejected', {
          error: 'Could not verify your rating right now. Please try again in a moment.',
          requiresClaim: false
        });
        return;
      }
      console.log(`[GATEKEEPER] ✓ ${effectiveName} verified with $HELO`);
    }
    
    // Step 1: Remove from queue if already there (prevent duplicates)
    const existingIndex = matchmakingQueue.findIndex(p => p.playerId === effectivePlayerId);
    if (existingIndex !== -1) {
      matchmakingQueue.splice(existingIndex, 1);
      console.log(`[MATCH] Removed ${effectiveName} from duplicate queue entry`);
    }

    // Step 2: Check if player has an ACTIVE game
    let foundActiveGame = false;
    for (const [gameId, gameState] of activeGames.entries()) {
      if ((gameState.players.white.id === effectivePlayerId || gameState.players.black.id === effectivePlayerId) && 
          gameState.status === 'active') {
        
        const color = gameState.players.white.id === effectivePlayerId ? 'white' : 'black';
        const otherColor = color === 'white' ? 'black' : 'white';
        
        // Always allow reconnection to active games
        foundActiveGame = true;
        gameState.players[color].socketId = socket.id;
        gameState.players[color].connected = true;

        if (disconnectTimers.has(gameId)) {
          clearTimeout(disconnectTimers.get(gameId));
          disconnectTimers.delete(gameId);
          console.log(`[DISCONNECT] Cleared disconnect timer for game ${gameId} on reconnect`);
        }
        
        // Fetch avatar URLs
        let myAvatarUrl = null;
        let opponentAvatarUrl = null;
        
        if (dbEnabled) {
          if (gameState.players[color].walletAddress) {
            const myStats = await db.getUserStatsByWallet(gameState.players[color].walletAddress);
            myAvatarUrl = myStats?.avatar_url || null;
          }
          
          if (gameState.players[otherColor].walletAddress) {
            const oppStats = await db.getUserStatsByWallet(gameState.players[otherColor].walletAddress);
            opponentAvatarUrl = oppStats?.avatar_url || null;
          }
        }
        
        socket.join(gameId);
        socket.emit('game_found', {
          gameId,
          color,
          opponent: { 
            name: gameState.players[otherColor].name,
            elo: gameState.players[otherColor].elo || DEFAULT_ELO,
            avatar: opponentAvatarUrl
          },
          fen: gameState.game.fen(),
          timeLeft: gameState.players[color].timeLeft,
          opponentTimeLeft: gameState.players[otherColor].timeLeft,
          myElo: gameState.players[color].elo || DEFAULT_ELO,
          myAvatar: myAvatarUrl,
          timeControl: gameState.timeControl || 600000
        });
        
        console.log(`[RECONNECT] ${effectiveName} reconnected to game ${gameId} as ${color}`);
        
        // Notify opponent if they're still connected
        if (gameState.players[otherColor].connected) {
          io.to(gameId).emit('opponent_reconnected', { color });
        }
        break;
      }
    }

    // Step 3: If no active game found, add to matchmaking queue
    if (!foundActiveGame) {
      matchmakingQueue.push({
        socketId: socket.id,
        playerId: effectivePlayerId,
        walletAddress: walletAddress || null,
        playerName: effectiveName,
        timeControl: timeControl || 600000,
        joinedAt: Date.now()
      });

      playerSockets.set(socket.id, { 
        playerId: effectivePlayerId, 
        walletAddress: walletAddress || null,
        playerName: effectiveName 
      });
      
      socket.emit('queue_joined', { position: matchmakingQueue.length });
      updateMetrics();
      
      console.log(`[Q] ${effectiveName} joined queue (Position: ${matchmakingQueue.length})`);

      // Step 4: Try to match players immediately
      tryMatchPlayers().catch(err => 
        console.error('[MATCH] Error matching players:', err)
      );
    }
  });

  // Cancel matchmaking
  socket.on('cancel_matchmaking', () => {
    const index = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      const player = matchmakingQueue.splice(index, 1)[0];
      socket.emit('matchmaking_cancelled');
      console.log(`Player ${player.playerId} left matchmaking queue`);
    }
  });

  // Make a move
  socket.on('make_move', ({ gameId, move }) => {
    const gameState = activeGames.get(gameId);
    
    if (!gameState) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    if (gameState.status !== 'active') {
      socket.emit('error', { message: 'Game is not active' });
      return;
    }

    // Validate that the player is in this game and it's their turn
    const currentTurn = gameState.game.turn(); // 'w' or 'b'
    let playerColor = null;
    
    if (gameState.players.white.socketId === socket.id) {
      playerColor = 'w';
    } else if (gameState.players.black.socketId === socket.id) {
      playerColor = 'b';
    } else {
      socket.emit('error', { message: 'You are not a player in this game' });
      return;
    }

    if (playerColor !== currentTurn) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    try {
      // Attempt the move
      const result = gameState.game.move(move);

      if (result) {
        const now = Date.now();
        const colorName = playerColor === 'w' ? 'white' : 'black';
        const opponentColor = playerColor === 'w' ? 'black' : 'white';

        // Update time
        const timeTaken = now - gameState.players[colorName].lastMoveTime;
        gameState.players[colorName].timeLeft -= timeTaken;
        gameState.players[opponentColor].lastMoveTime = now;
        gameState.lastActivity = now;

        if (gameState.players[colorName].timeLeft <= 0) {
          gameState.players[colorName].timeLeft = 0;
          gameState.status = 'completed';
          const winner = opponentColor;
          const reason = 'timeout';
          gameState.result = { winner, reason };
          metrics.totalGamesCompleted++;

          io.to(gameId).emit('game_over', {
            winner,
            reason,
            finalFen: gameState.game.fen()
          });

          console.log(`[END] Game ${gameId}: winner=${winner}, reason=${reason}`);
          handleGameSettlement(gameState);
          return;
        }

        // Record move
        gameState.moveHistory.push({
          move: result.san,
          fen: gameState.game.fen(),
          timestamp: now,
          timeLeft: gameState.players[colorName].timeLeft
        });

        metrics.totalMoves++;

        // Clear any pending draw offer after a move
        gameState.drawOffer = null;

        // Broadcast new state to all in room
        io.to(gameId).emit('board_state', {
          fen: gameState.game.fen(),
          lastMove: { from: result.from, to: result.to },
          whiteTime: gameState.players.white.timeLeft,
          blackTime: gameState.players.black.timeLeft,
          moveHistory: gameState.moveHistory
        });

        // Check for game over
        if (gameState.game.isGameOver()) {
          let winner = null;
          let reason = '';

          if (gameState.game.isCheckmate()) {
            // The player who just moved delivered checkmate and wins
            winner = playerColor === 'w' ? 'white' : 'black';
            reason = 'checkmate';
          } else if (gameState.game.isStalemate()) {
            winner = 'draw';
            reason = 'stalemate';
          } else if (gameState.game.isThreefoldRepetition()) {
            winner = 'draw';
            reason = 'threefold repetition';
          } else if (gameState.game.isInsufficientMaterial()) {
            winner = 'draw';
            reason = 'insufficient material';
          } else if (gameState.game.isDraw()) {
            winner = 'draw';
            reason = 'draw';
          }

          gameState.status = 'completed';
          gameState.result = { winner, reason };
          
          metrics.totalGamesCompleted++;

          // Emit game_over to players
          io.to(gameId).emit('game_over', {
            winner,
            reason,
            finalFen: gameState.game.fen()
          });

          console.log(`[END] Game ${gameId}: winner=${winner}, reason=${reason}, playerWhoMoved=${playerColor === 'w' ? 'white' : 'black'}`);
          
          // Trigger immediate settlement (backend oracle)
          handleGameSettlement(gameState).catch(err => 
            console.error('[SETTLEMENT] Failed to settle game:', err)
          );
          
          // Save to database if enabled
          if (dbEnabled) {
            saveGameToDatabase(gameState).catch(err => 
              console.error('[DB] Failed to save game:', err)
            );
          }
          
          // Mark game for cleanup (extended to allow settlement)
          setTimeout(() => {
            if (activeGames.has(gameId)) {
              activeGames.delete(gameId);
              console.log(`[CLEANUP] Removed completed game ${gameId}`);
            }
          }, 300000); // Remove after 5 minutes
        }
      }
    } catch (e) {
      console.log(`Invalid move in ${gameId}:`, move, e.message);
      socket.emit('invalid_move', { error: e.message });
    }
  });

  // Offer draw
  socket.on('offer_draw', ({ gameId }) => {
    const gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'active') return;

    const playerColor = gameState.players.white.socketId === socket.id ? 'white' : 'black';
    const opponentColor = playerColor === 'white' ? 'black' : 'white';

    gameState.drawOffer = playerColor;
    
    const opponentSocketId = gameState.players[opponentColor].socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('draw_offered', { from: playerColor });
    }

    console.log(`[DRAW] ${playerColor} offered draw in game ${gameId}`);
  });

  // Cancel draw offer
  socket.on('cancel_draw_offer', ({ gameId }) => {
    const gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'active') return;

    const playerColor = gameState.players.white.socketId === socket.id ? 'white' : 'black';
    const opponentColor = playerColor === 'white' ? 'black' : 'white';

    // Only allow cancelling if this player offered it
    if (gameState.drawOffer === playerColor) {
      gameState.drawOffer = null;
      
      const opponentSocketId = gameState.players[opponentColor].socketId;
      if (opponentSocketId) {
        io.to(opponentSocketId).emit('draw_offer_cancelled', { by: playerColor });
      }

      console.log(`[DRAW] ${playerColor} cancelled draw offer in game ${gameId}`);
    }
  });

  // Accept draw
  socket.on('accept_draw', ({ gameId }) => {
    const gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'active') {
      console.log(`[DRAW] Cannot accept - game ${gameId} not active`);
      return;
    }

    // Verify there's actually a pending draw offer
    if (!gameState.drawOffer) {
      console.log(`[DRAW] Cannot accept - no pending draw offer in game ${gameId}`);
      socket.emit('error', { message: 'No pending draw offer' });
      return;
    }

    const acceptingPlayer = gameState.players.white.socketId === socket.id ? 'white' : 'black';
    
    // Verify the accepting player is not the one who offered
    if (gameState.drawOffer === acceptingPlayer) {
      console.log(`[DRAW] Cannot accept - player ${acceptingPlayer} is trying to accept their own offer`);
      socket.emit('error', { message: 'Cannot accept your own draw offer' });
      return;
    }

    gameState.status = 'completed';
    gameState.result = { winner: 'draw', reason: 'agreement' };

    io.to(gameId).emit('game_over', {
      winner: 'draw',
      reason: 'agreement',
      finalFen: gameState.game.fen()
    });

    console.log(`[END] Game ${gameId} ended by draw agreement (offered by ${gameState.drawOffer}, accepted by ${acceptingPlayer})`);
    
    // Trigger immediate settlement
    handleGameSettlement(gameState).catch(err => 
      console.error('[SETTLEMENT] Failed to settle game:', err)
    );
    
    // Save to database if enabled
    if (dbEnabled) {
      saveGameToDatabase(gameState).catch(err => 
        console.error('[DB] Failed to save game:', err)
      );
    }
    
    // Mark game for cleanup
    setTimeout(() => {
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        console.log(`[CLEANUP] Removed completed game ${gameId}`);
      }
    }, 60000); // Remove after 1 minute
  });

  // Decline draw
  socket.on('decline_draw', ({ gameId }) => {
    const gameState = activeGames.get(gameId);
    if (!gameState) return;

    const playerColor = gameState.players.white.socketId === socket.id ? 'white' : 'black';
    const opponentColor = playerColor === 'white' ? 'black' : 'white';
    
    gameState.drawOffer = null;
    
    const opponentSocketId = gameState.players[opponentColor].socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('draw_declined');
    }

    console.log(`[DRAW] ${playerColor} declined draw offer in game ${gameId}`);
  });

  // Resign
  socket.on('resign', ({ gameId }) => {
    const gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'active') return;

    const playerColor = gameState.players.white.socketId === socket.id ? 'white' : 'black';
    const winner = playerColor === 'white' ? 'black' : 'white';

    gameState.status = 'completed';
    gameState.result = { winner, reason: 'resignation' };

    io.to(gameId).emit('game_over', {
      winner,
      reason: 'resignation',
      finalFen: gameState.game.fen()
    });

    console.log(`[END] Game ${gameId}: ${playerColor} resigned`);
    
    // Trigger immediate settlement
    handleGameSettlement(gameState).catch(err => 
      console.error('[SETTLEMENT] Failed to settle game:', err)
    );
    
    // Save to database if enabled
    if (dbEnabled) {
      saveGameToDatabase(gameState).catch(err => 
        console.error('[DB] Failed to save game:', err)
      );
    }
    
    // Mark game for cleanup
    setTimeout(() => {
      if (activeGames.has(gameId)) {
        activeGames.delete(gameId);
        console.log(`[CLEANUP] Removed completed game ${gameId}`);
      }
    }, 60000); // Remove after 1 minute
  });

  // ============================================================================
  // CHALLENGE ACCEPTANCE HANDLERS
  // ============================================================================

  // Accept match challenge
  socket.on('accept_challenge', async ({ challengeId, notificationId }) => {
    try {
      console.log(`[CHALLENGE] Accept request for ${challengeId} from socket ${socket.id}`);
      
      const challenge = activeChallenges.get(challengeId);
      
      if (!challenge) {
        socket.emit('CHALLENGE_ERROR', { error: 'Challenge not found or expired' });
        return;
      }
      
      if (challenge.status !== 'pending') {
        socket.emit('CHALLENGE_ERROR', { error: 'Challenge already processed' });
        return;
      }
      
      // Verify acceptor is the opponent
      const acceptorInfo = playerSockets.get(socket.id);
      if (!acceptorInfo || acceptorInfo.playerId !== challenge.opponentId) {
        socket.emit('CHALLENGE_ERROR', { error: 'Unauthorized' });
        return;
      }
      
      // Check if challenger is still online
      const challengerSockets = Array.from(playerSockets.entries())
        .filter(([_, data]) => data.playerId === challenge.challengerId)
        .map(([socketId]) => socketId);
      
      if (challengerSockets.length === 0) {
        socket.emit('CHALLENGE_ERROR', { error: 'Challenger is no longer online' });
        
        // Mark notification as expired
        if (dbEnabled) {
          await db.updateNotificationStatus(notificationId, acceptorInfo.playerId, 'expired');
        }
        
        // Cleanup
        activeChallenges.delete(challengeId);
        if (challengeTimers.has(challengeId)) {
          clearTimeout(challengeTimers.get(challengeId));
          challengeTimers.delete(challengeId);
        }
        return;
      }
      
      // Mark challenge as accepted
      challenge.status = 'accepted';
      
      // Clear expiration timer
      if (challengeTimers.has(challengeId)) {
        clearTimeout(challengeTimers.get(challengeId));
        challengeTimers.delete(challengeId);
      }
      
      // Update notification status
      if (dbEnabled) {
        await db.updateNotificationStatus(notificationId, acceptorInfo.playerId, 'accepted');
      }
      
      // Create private game
      const gameId = `friend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Randomly assign colors
      const assignWhite = Math.random() < 0.5;
      const whitePlayerId = assignWhite ? challenge.challengerId : challenge.opponentId;
      const blackPlayerId = assignWhite ? challenge.opponentId : challenge.challengerId;
      
      const gameState = createGameState(gameId, whitePlayerId, blackPlayerId);
      
      // Mark as unranked friend match
      gameState.isRanked = false;
      gameState.isFriendMatch = true;
      gameState.timeControl = challenge.timeControl;
      
      // Set time controls
      gameState.players.white.timeLeft = challenge.timeControl;
      gameState.players.black.timeLeft = challenge.timeControl;
      
      // Get player info
      const challengerInfo = Array.from(playerSockets.entries())
        .find(([_, data]) => data.playerId === challenge.challengerId)?.[1];
      const opponentInfo = playerSockets.get(socket.id);
      
      // Get ELO ratings and usernames from database
      let whiteStats = null;
      let blackStats = null;
      if (dbEnabled) {
        whiteStats = await db.getUserStatsByWallet(whitePlayerId);
        blackStats = await db.getUserStatsByWallet(blackPlayerId);
      }
      
      // Assign socket IDs and info
      if (assignWhite) {
        gameState.players.white.socketId = challengerSockets[0];
        gameState.players.white.connected = true;
        gameState.players.white.name = whiteStats?.username || challengerInfo?.playerName || `${challenge.challengerId.slice(0, 6)}...${challenge.challengerId.slice(-4)}`;
        gameState.players.white.walletAddress = challenge.challengerId;
        gameState.players.white.elo = whiteStats?.elo_rating || DEFAULT_ELO;
        
        gameState.players.black.socketId = socket.id;
        gameState.players.black.connected = true;
        gameState.players.black.name = blackStats?.username || opponentInfo?.playerName || `${challenge.opponentId.slice(0, 6)}...${challenge.opponentId.slice(-4)}`;
        gameState.players.black.walletAddress = challenge.opponentId;
        gameState.players.black.elo = blackStats?.elo_rating || DEFAULT_ELO;
      } else {
        gameState.players.black.socketId = challengerSockets[0];
        gameState.players.black.connected = true;
        gameState.players.black.name = blackStats?.username || challengerInfo?.playerName || `${challenge.challengerId.slice(0, 6)}...${challenge.challengerId.slice(-4)}`;
        gameState.players.black.walletAddress = challenge.challengerId;
        gameState.players.black.elo = blackStats?.elo_rating || DEFAULT_ELO;
        
        gameState.players.white.socketId = socket.id;
        gameState.players.white.connected = true;
        gameState.players.white.name = whiteStats?.username || opponentInfo?.playerName || `${challenge.opponentId.slice(0, 6)}...${challenge.opponentId.slice(-4)}`;
        gameState.players.white.walletAddress = challenge.opponentId;
        gameState.players.white.elo = whiteStats?.elo_rating || DEFAULT_ELO;
      }
      
      // Store game
      activeGames.set(gameId, gameState);
      walletToGame.set(challenge.challengerId, gameId);
      walletToGame.set(challenge.opponentId, gameId);
      
      metrics.totalGamesCreated++;
      
      console.log(`[CHALLENGE] Created friend match ${gameId}: ${whitePlayerId.slice(0, 8)} (${gameState.players.white.name}) vs ${blackPlayerId.slice(0, 8)} (${gameState.players.black.name})`);
      
      // Join both players to game room
      challengerSockets[0] && io.sockets.sockets.get(challengerSockets[0])?.join(gameId);
      socket.join(gameId);
      
      // Fetch avatar URLs for both players
      let challengerAvatarUrl = null;
      let opponentAvatarUrl = null;
      
      if (dbEnabled) {
        if (gameState.players.white.walletAddress) {
          const whiteStats = await db.getUserStatsByWallet(gameState.players.white.walletAddress);
          if (assignWhite) {
            challengerAvatarUrl = whiteStats?.avatar_url || null;
          } else {
            opponentAvatarUrl = whiteStats?.avatar_url || null;
          }
        }
        
        if (gameState.players.black.walletAddress) {
          const blackStats = await db.getUserStatsByWallet(gameState.players.black.walletAddress);
          if (!assignWhite) {
            challengerAvatarUrl = blackStats?.avatar_url || null;
          } else {
            opponentAvatarUrl = blackStats?.avatar_url || null;
          }
        }
      }
      
      // Emit MATCH_STARTING to both players
      const challengerColor = assignWhite ? 'white' : 'black';
      const opponentColor = assignWhite ? 'black' : 'white';
      
      // To challenger
      io.to(challengerSockets[0]).emit('MATCH_STARTING', {
        gameId,
        color: challengerColor,
        opponent: {
          name: gameState.players[opponentColor].name,
          elo: gameState.players[opponentColor].elo,
          avatar: opponentAvatarUrl
        },
        fen: gameState.game.fen(),
        timeLeft: challenge.timeControl,
        opponentTimeLeft: challenge.timeControl,
        myElo: gameState.players[challengerColor].elo,
        myAvatar: challengerAvatarUrl,
        opponentElo: gameState.players[opponentColor].elo,
        isRanked: false,
        isFriendMatch: true,
      });
      
      // To opponent (acceptor)
      socket.emit('MATCH_STARTING', {
        gameId,
        color: opponentColor,
        opponent: {
          name: gameState.players[challengerColor].name,
          elo: gameState.players[challengerColor].elo,
          avatar: challengerAvatarUrl
        },
        fen: gameState.game.fen(),
        timeLeft: challenge.timeControl,
        opponentTimeLeft: challenge.timeControl,
        myElo: gameState.players[opponentColor].elo,
        myAvatar: opponentAvatarUrl,
        opponentElo: gameState.players[challengerColor].elo,
        isRanked: false,
        isFriendMatch: true,
      });
      
      // Cleanup challenge
      activeChallenges.delete(challengeId);
      playerChallenges.get(challenge.challengerId)?.delete(challengeId);
      
    } catch (error) {
      console.error('[CHALLENGE] Error accepting challenge:', error);
      socket.emit('CHALLENGE_ERROR', { error: 'Failed to create game' });
    }
  });

  // Cancel challenge (challenger only)
  socket.on('cancel_challenge', async ({ challengeId }) => {
    const challenge = activeChallenges.get(challengeId);
    
    if (!challenge) {
      return;
    }
    
    const senderInfo = playerSockets.get(socket.id);
    if (!senderInfo || senderInfo.playerId !== challenge.challengerId) {
      return;
    }
    
    // Clear timer
    if (challengeTimers.has(challengeId)) {
      clearTimeout(challengeTimers.get(challengeId));
      challengeTimers.delete(challengeId);
    }
    
    // Mark notification as declined
    if (dbEnabled) {
      await db.updateNotificationStatus(challenge.notificationId, challenge.opponentId, 'expired');
    }
    
    // Notify opponent
    const opponentSockets = Array.from(playerSockets.entries())
      .filter(([_, data]) => data.playerId === challenge.opponentId)
      .map(([socketId]) => socketId);
    
    opponentSockets.forEach(socketId => {
      io.to(socketId).emit('CHALLENGE_CANCELLED', {
        challengeId,
        notificationId: challenge.notificationId,
      });
    });
    
    // Cleanup
    activeChallenges.delete(challengeId);
    playerChallenges.get(challenge.challengerId)?.delete(challengeId);
    
    console.log(`[CHALLENGE] Challenge ${challengeId} cancelled by challenger`);
  });

  // Join game room (for reconnection after navigation)
  socket.on('join_game_room', ({ gameId, walletAddress }) => {
    if (!gameId) return;
    
    const gameState = activeGames.get(gameId);
    if (!gameState) {
      console.log(`[ROOM] Game ${gameId} not found`);
      return;
    }
    
    // Get player ID from parameter or playerSockets
    let playerId = null;
    if (walletAddress) {
      playerId = walletAddress.toLowerCase();
    } else {
      const playerInfo = playerSockets.get(socket.id);
      if (playerInfo) {
        playerId = playerInfo.playerId;
      }
    }
    
    if (!playerId) {
      console.log(`[ROOM] Socket ${socket.id} - no wallet address provided and not registered`);
      return;
    }
    
    let playerColor = null;
    
    if (gameState.players.white.walletAddress?.toLowerCase() === playerId) {
      playerColor = 'white';
    } else if (gameState.players.black.walletAddress?.toLowerCase() === playerId) {
      playerColor = 'black';
    }
    
    if (!playerColor) {
      console.log(`[ROOM] Player ${playerId.slice(0, 8)} not authorized for game ${gameId}`);
      console.log(`[ROOM] Game has white: ${gameState.players.white.walletAddress}, black: ${gameState.players.black.walletAddress}`);
      return;
    }
    
    // Update socket ID and join room
    gameState.players[playerColor].socketId = socket.id;
    gameState.players[playerColor].connected = true;

    if (disconnectTimers.has(gameId)) {
      clearTimeout(disconnectTimers.get(gameId));
      disconnectTimers.delete(gameId);
      console.log(`[DISCONNECT] Cleared disconnect timer for game ${gameId} on join_game_room`);
    }

    socket.join(gameId);
    
    console.log(`[ROOM] Player ${playerId.slice(0, 8)} (${playerColor}) joined room ${gameId}, socket: ${socket.id}`);
    
    // Notify opponent of reconnection
    const otherColor = playerColor === 'white' ? 'black' : 'white';
    if (gameState.players[otherColor]?.connected) {
      io.to(gameId).emit('opponent_reconnected', { color: playerColor });
    }
    
    // Send current board state
    socket.emit('board_state', {
      fen: gameState.game.fen(),
      lastMove: gameState.moveHistory.length > 0 
        ? { from: gameState.moveHistory[gameState.moveHistory.length - 1].from, to: gameState.moveHistory[gameState.moveHistory.length - 1].to }
        : null,
      whiteTime: gameState.players.white.timeLeft,
      blackTime: gameState.players.black.timeLeft,
      moveHistory: gameState.moveHistory
    });
  });

  // ============================================================================
  // SPECTATOR HANDLERS
  // ============================================================================

  // Join game as spectator (read-only)
  socket.on('spectate_game', ({ gameId }) => {
    if (!gameId) {
      socket.emit('spectate_error', { error: 'Game ID required' });
      return;
    }
    
    const gameState = activeGames.get(gameId);
    if (!gameState) {
      socket.emit('spectate_error', { error: 'Game not found' });
      return;
    }
    
    if (gameState.status !== 'active') {
      socket.emit('spectate_error', { error: 'Game is not active' });
      return;
    }
    
    // Check if socket is already a player in this game
    const isPlayer = gameState.players.white.socketId === socket.id || 
                     gameState.players.black.socketId === socket.id;
    
    if (isPlayer) {
      socket.emit('spectate_error', { error: 'You are already playing in this game' });
      return;
    }
    
    // Add to spectators set
    gameState.spectators.add(socket.id);
    
    // Join the socket room to receive updates
    socket.join(gameId);
    
    console.log(`[SPECTATE] Socket ${socket.id} joined game ${gameId} as spectator (${gameState.spectators.size} total)`);
    
    // Send current game state to spectator
    socket.emit('spectate_joined', {
      gameId,
      whitePlayer: {
        name: gameState.players.white.name || 'Player',
        elo: gameState.players.white.elo || 1200,
      },
      blackPlayer: {
        name: gameState.players.black.name || 'Player',
        elo: gameState.players.black.elo || 1200,
      },
      fen: gameState.game.fen(),
      whiteTime: gameState.players.white.timeLeft,
      blackTime: gameState.players.black.timeLeft,
      moveHistory: gameState.moveHistory,
      lastMove: gameState.moveHistory.length > 0 
        ? { 
            from: gameState.moveHistory[gameState.moveHistory.length - 1].move?.from,
            to: gameState.moveHistory[gameState.moveHistory.length - 1].move?.to 
          }
        : null,
      spectatorCount: gameState.spectators.size,
    });
    
    // Notify players about new spectator count
    io.to(gameId).emit('spectator_count_updated', { 
      count: gameState.spectators.size 
    });
  });

  // Leave spectating
  socket.on('leave_spectate', ({ gameId }) => {
    if (!gameId) return;
    
    const gameState = activeGames.get(gameId);
    if (!gameState) return;
    
    // Remove from spectators
    if (gameState.spectators.has(socket.id)) {
      gameState.spectators.delete(socket.id);
      socket.leave(gameId);
      
      console.log(`[SPECTATE] Socket ${socket.id} left game ${gameId} (${gameState.spectators.size} remaining)`);
      
      // Notify remaining spectators and players about count change
      io.to(gameId).emit('spectator_count_updated', { 
        count: gameState.spectators.size 
      });
    }
  });

  // Handle disconnect
  // Broadcast backend URL change (admin only - with verification)
  socket.on('broadcast_backend_url', ({ backendUrl, adminWallet }) => {
    // SECURITY: Verify admin wallet
    if (!adminWallet || !ADMIN_WALLETS.includes(adminWallet.toLowerCase())) {
      console.log(`[ADMIN] ⚠ UNAUTHORIZED backend URL broadcast attempt from: ${adminWallet || 'unknown'}`);
      socket.emit('error', { message: 'Unauthorized: Admin access required' });
      return;
    }
    
    const totalClients = io.sockets.sockets.size;
    const otherClients = totalClients - 1;
    
    const normalizedUrl = backendUrl.trim().replace(/\/+$/, '');
    serverBackendUrl = normalizedUrl;
    
    // Save to config file
    if (!saveBackendConfig(normalizedUrl)) {
      console.error('[ADMIN] ⚠ Failed to save backend URL to file');
      socket.emit('error', { message: 'Failed to save configuration' });
      return;
    }
    
    console.log(`\n========== ADMIN: BACKEND URL CHANGE ==========`);
    console.log(`[ADMIN] Broadcast received from wallet: ${adminWallet}`);
    console.log(`[ADMIN] New backend URL: ${normalizedUrl}`);
    console.log(`[ADMIN] Total connected clients: ${totalClients}`);
    console.log(`[ADMIN] Broadcasting to ${otherClients} other client(s)...`);
    
    // Broadcast to all connected clients except sender
    socket.broadcast.emit('backend_url_updated', { backendUrl: normalizedUrl });
    
    console.log(`[ADMIN] ✓ Broadcast sent successfully`);
    console.log(`[ADMIN] ✓ Configuration saved to file`);
    console.log(`[ADMIN] All users will be prompted to reload with the new URL`);
    console.log(`===============================================\n`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id} (Total: ${io.sockets.sockets.size})`);

    // Get player info before removing
    const disconnectedPlayer = playerSockets.get(socket.id);
    
    // Remove from matchmaking queue
    const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id);
    if (queueIndex !== -1) {
      const player = matchmakingQueue.splice(queueIndex, 1)[0];
      console.log(`[Q] ${player.playerName} left queue (Size: ${matchmakingQueue.length})`);
    }

    // Cancel pending challenges if challenger disconnects
    if (disconnectedPlayer) {
      const playerChallengeIds = playerChallenges.get(disconnectedPlayer.playerId);
      if (playerChallengeIds) {
        for (const challengeId of playerChallengeIds) {
          const challenge = activeChallenges.get(challengeId);
          if (challenge && challenge.status === 'pending') {
            console.log(`[CHALLENGE] Challenger disconnected, cancelling ${challengeId}`);
            
            // Clear timer
            if (challengeTimers.has(challengeId)) {
              clearTimeout(challengeTimers.get(challengeId));
              challengeTimers.delete(challengeId);
            }
            
            // Mark notification as expired
            if (dbEnabled) {
              db.updateNotificationStatus(challenge.notificationId, challenge.opponentId, 'expired')
                .catch(err => console.error('[CHALLENGE] Failed to update notification:', err));
            }
            
            // Notify opponent
            const opponentSockets = Array.from(playerSockets.entries())
              .filter(([_, data]) => data.playerId === challenge.opponentId)
              .map(([socketId]) => socketId);
            
            opponentSockets.forEach(socketId => {
              io.to(socketId).emit('CHALLENGE_CANCELLED', {
                challengeId,
                notificationId: challenge.notificationId,
                reason: 'Challenger disconnected',
              });
            });
            
            // Cleanup
            activeChallenges.delete(challengeId);
          }
        }
        playerChallenges.delete(disconnectedPlayer.playerId);
      }
    }

    // Handle disconnect for active games
    for (const [gameId, gameState] of activeGames.entries()) {
      // Check if disconnecting socket is a spectator
      if (gameState.spectators.has(socket.id)) {
        gameState.spectators.delete(socket.id);
        console.log(`[SPECTATE] Spectator ${socket.id} disconnected from game ${gameId} (${gameState.spectators.size} remaining)`);
        
        // Notify remaining spectators and players about count change
        io.to(gameId).emit('spectator_count_updated', { 
          count: gameState.spectators.size 
        });
        continue; // Skip to next game
      }
      
      let disconnectedWallet = null;
      let disconnectedColor = null;
      
      if (gameState.players.white.socketId === socket.id) {
        gameState.players.white.connected = false;
        gameState.players.white.socketId = null;
        disconnectedColor = 'white';
        disconnectedWallet = gameState.players.white.walletAddress;
        
        io.to(gameId).emit('opponent_disconnected', { 
          color: 'white',
          graceSeconds: 60
        });
        console.log(`[DISC] White disconnected from game ${gameId}, 60s grace period started`);
      } else if (gameState.players.black.socketId === socket.id) {
        gameState.players.black.connected = false;
        gameState.players.black.socketId = null;
        disconnectedColor = 'black';
        disconnectedWallet = gameState.players.black.walletAddress;
        
        io.to(gameId).emit('opponent_disconnected', { 
          color: 'black',
          graceSeconds: 60
        });
        console.log(`[DISC] Black disconnected from game ${gameId}, 60s grace period started`);
      }
      
      // Start 60-second abandonment timer
      if (disconnectedWallet && disconnectedColor) {
        const timer = setTimeout(() => {
          if (activeGames.has(gameId)) {
            const gs = activeGames.get(gameId);
            if (!gs.players[disconnectedColor].connected) {
              // Player never reconnected - award win to REMAINING player (opponent)
              const winnerColor = disconnectedColor === 'white' ? 'black' : 'white';
              gs.status = 'completed';
              gs.result = { winner: winnerColor, reason: 'abandonment' };
              
              io.to(gameId).emit('game_over', {
                winner: winnerColor,
                reason: 'abandonment',
                finalFen: gs.game.fen()
              });
              
              // Trigger immediate settlement
              handleGameSettlement(gs).catch(err => 
                console.error('[SETTLEMENT] Failed to settle game:', err)
              );
              
              console.log(`[ABANDON] Game ${gameId}: ${disconnectedColor} abandoned, ${winnerColor} wins`);
              
              // Save to database if enabled
              if (dbEnabled) {
                saveGameToDatabase(gs).catch(err => 
                  console.error('[DB] Failed to save game:', err)
                );
              }
              
              // Cleanup
              if (gs.players.white.walletAddress) {
                walletToGame.delete(gs.players.white.walletAddress.toLowerCase());
              }
              if (gs.players.black.walletAddress) {
                walletToGame.delete(gs.players.black.walletAddress.toLowerCase());
              }
              disconnectTimers.delete(disconnectedWallet.toLowerCase());
              
              setTimeout(() => activeGames.delete(gameId), 60000);
            }
          }
        }, 60000); // 60 seconds
        
        disconnectTimers.set(disconnectedWallet.toLowerCase(), timer);
      }
    }

    playerSockets.delete(socket.id);
    
    // Update database online status if player was registered
    if (disconnectedPlayer && dbEnabled) {
      // Check if player has any other active sockets
      const hasOtherSockets = Array.from(playerSockets.values())
        .some(data => data.playerId === disconnectedPlayer.playerId);
      
      // Only mark offline if no other sockets remain
      if (!hasOtherSockets) {
        db.setUserOnlineStatus(disconnectedPlayer.playerId, false)
          .then(() => {
            // Broadcast status update to all connected clients
            io.emit('user_status_changed', {
              walletAddress: disconnectedPlayer.playerId,
              is_online: false,
              timestamp: Date.now()
            });
            console.log(`[STATUS] ${disconnectedPlayer.playerId.slice(0, 8)}... → offline`);
          })
          .catch(err => console.error('[STATUS] Failed to update online status:', err));
      }
    }
  });
});

// Cleanup inactive games every 5 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  let cleaned = 0;

  for (const [gameId, gameState] of activeGames.entries()) {
    if (now - gameState.lastActivity > timeout) {
      console.log(`[CLEANUP] Removing inactive game: ${gameId}`);
      activeGames.delete(gameId);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`[CLEANUP] Removed ${cleaned} inactive games. Active: ${activeGames.size}`);
  }
}, 5 * 60 * 1000);

/**
 * Automatic blockchain sync on server startup
 * Syncs all players' ELO from database to blockchain using BATCH operations
 * 
 * OPTIMIZED: Uses batchAdjustElo contract function for efficient gas usage
 */
async function autoSyncOnStartup() {
  if (!isSettlementEnabled()) {
    console.log('[AUTO-SYNC] Skipped - settlement service not configured');
    return;
  }

  if (!dbEnabled) {
    console.log('[AUTO-SYNC] Skipped - database not enabled');
    return;
  }

  console.log('[AUTO-SYNC] Starting automatic blockchain sync...');

  try {
    // Get all players from database
    const players = await db.listPlayers(100);
    const { isAddress } = require('viem');
    const addresses = players
      .map(p => p.wallet_address)
      .filter(addr => addr && typeof addr === 'string' && isAddress(addr));

    if (addresses.length === 0) {
      console.log('[AUTO-SYNC] No players with valid wallet addresses found to sync');
      return;
    }

    console.log(`[AUTO-SYNC] Found ${addresses.length} valid player addresses, checking sync status...`);

    // Check which players need sync
    const needsSyncList = [];
    for (const address of addresses) {
      try {
        const stats = await db.getUserStatsByWallet(address);
        const databaseElo = stats?.elo_rating ?? DEFAULT_ELO;
        const status = await getSyncStatus(address, databaseElo);

        if (status.needsSync) {
          needsSyncList.push({ walletAddress: address, databaseElo });
        }
      } catch (err) {
        console.error(`[AUTO-SYNC] Error checking ${address}:`, err.message);
      }
    }

    if (needsSyncList.length === 0) {
      console.log('[AUTO-SYNC] ✓ All players already in sync');
      return;
    }

    console.log(`[AUTO-SYNC] Syncing ${needsSyncList.length} players out of sync...`);
    console.log(`[AUTO-SYNC] 🚀 Using BATCH transaction (1 tx instead of ${needsSyncList.length} txs)`);

    // Use batch reconciliation
    const result = await batchReconcilePlayers(needsSyncList);

    if (result.success) {
      console.log(`[AUTO-SYNC] ✓ Batch sync complete!`);
      console.log(`[AUTO-SYNC]   Transaction: ${result.txHash}`);
      console.log(`[AUTO-SYNC]   Synced: ${result.adjustments?.length || 0}`);
      console.log(`[AUTO-SYNC]   Skipped: ${result.skipped || 0}`);
      
      // Log individual adjustments
      if (result.adjustments) {
        result.adjustments.forEach(adj => {
          console.log(`[AUTO-SYNC]   ✓ ${adj.address.slice(0, 8)}... ${adj.adjustment} → ${adj.expectedAfter}`);
        });
      }
      
      console.log(`[AUTO-SYNC] 💰 Gas savings: ~${(needsSyncList.length - 1) * 90}% (1 tx vs ${needsSyncList.length} txs)`);
    } else {
      console.error(`[AUTO-SYNC] ✗ Batch sync failed: ${result.error}`);
    }
  } catch (err) {
    console.error('[AUTO-SYNC] Failed:', err.message);
  }
}

const PORT = process.env.PORT || 4000;
server.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          ⚡ HemiChess Server Started ⚡              ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                        ║
║  WebSocket Transport: Enabled                         ║
║  Max Connections: Unlimited                           ║
║  Capacity: 100+ concurrent games                      ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  // Check oracle wallet balance on startup
  if (isSettlementEnabled()) {
    try {
      const { createPublicClient, http, formatEther } = require('viem');
      const client = createPublicClient({
        chain: {
          id: 743111,
          name: 'Hemi Sepolia',
          rpcUrls: { default: { http: ['https://testnet.rpc.hemi.network/rpc'] } }
        },
        transport: http()
      });
      
      const oracleAddress = getOracleAddress();
      const balance = await client.getBalance({ address: oracleAddress });
      const balanceInEth = parseFloat(formatEther(balance));
      
      console.log(`[ORACLE] Wallet: ${oracleAddress}`);
      console.log(`[ORACLE] Balance: ${balanceInEth.toFixed(6)} ETH`);
      
      // Warn if balance is low
      if (balanceInEth < 0.001) {
        console.log('⚠️  WARNING: Oracle wallet balance is critically low!');
        console.log('⚠️  Settlements may fail due to insufficient gas.');
        console.log('⚠️  Please add testnet ETH to:', oracleAddress);
      } else if (balanceInEth < 0.01) {
        console.log('⚠️  NOTICE: Oracle wallet balance is getting low.');
        console.log('   Consider adding more testnet ETH to:', oracleAddress);
      } else {
        console.log('✓ Oracle wallet has sufficient balance for settlements');
      }
    } catch (err) {
      console.error('[ORACLE] Failed to check balance:', err.message);
    }
  }
  
  // Check balance every hour
  if (isSettlementEnabled()) {
    setInterval(async () => {
      try {
        const { createPublicClient, http, formatEther } = require('viem');
        const client = createPublicClient({
          chain: {
            id: 743111,
            name: 'Hemi Sepolia',
            rpcUrls: { default: { http: ['https://testnet.rpc.hemi.network/rpc'] } }
          },
          transport: http()
        });
        
        const oracleAddress = getOracleAddress();
        const balance = await client.getBalance({ address: oracleAddress });
        const balanceInEth = parseFloat(formatEther(balance));
        
        if (balanceInEth < 0.001) {
          console.log('\n⚠️  ALERT: Oracle wallet balance critically low:', balanceInEth.toFixed(6), 'ETH');
          console.log('   Address:', oracleAddress);
          console.log('   Settlements will fail without gas!\n');
        } else if (balanceInEth < 0.01) {
          console.log('\n[ORACLE] Balance check:', balanceInEth.toFixed(6), 'ETH (getting low)');
        }
      } catch (err) {
        console.error('[ORACLE] Balance check failed:', err.message);
      }
    }, 3600000); // Every hour
  }

  // Run automatic blockchain sync on startup
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  autoSyncOnStartup().catch(err => {
    console.error('[AUTO-SYNC] Startup sync failed:', err.message);
  });
});