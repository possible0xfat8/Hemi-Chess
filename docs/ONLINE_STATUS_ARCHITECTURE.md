# Online Status System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HemiChess Online Status                   │
│                         Real-time System                         │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser    │◄────────┤   Backend    │◄────────┤   Database   │
│   Client     │         │   Server     │         │  PostgreSQL  │
└──────────────┘         └──────────────┘         └──────────────┘
      ▲                         ▲                         ▲
      │                         │                         │
   WebSocket              Socket.IO Server           Supabase
  Connection                                          Client
```

## Component Architecture

```
Frontend (React + TypeScript)
├── Hooks
│   ├── useOnlineStatus(wallets[])      → Track multiple users
│   ├── useMyOnlineStatus()             → Manage own status
│   └── useOnlineCount()                → Get online count
│
├── Components
│   ├── <OnlineStatusToggle />          → Status preference dropdown
│   ├── <OnlineUserCount />             → Live player counter
│   ├── <Avatar showOnline isOnline />  → Status indicator
│   ├── <FriendsList />                 → Real-time friend status
│   └── <Navbar />                      → Header with status widgets
│
└── WebSocket Client (socket.io-client)
    ├── Subscribe: user_status_changed
    ├── Subscribe: user_status_preference_changed
    └── Emit: register_player

Backend (Node.js + Express)
├── WebSocket Server (Socket.IO)
│   ├── Event: register_player          → Mark user online
│   ├── Event: disconnect               → Mark user offline
│   ├── Broadcast: user_status_changed
│   └── Broadcast: user_status_preference_changed
│
├── API Endpoints
│   ├── POST /api/user/status           → Update preference
│   ├── GET  /api/user/:wallet/status   → Get status
│   └── POST /api/user/heartbeat        → Update last seen
│
└── Database Layer (Supabase Client)
    ├── setUserOnlineStatus()
    ├── setUserStatusPreference()
    ├── getUserOnlineStatus()
    ├── getOnlineUsers()
    └── updateLastSeen()

Database (PostgreSQL)
└── players table
    ├── last_seen (TIMESTAMP)           → When last online
    ├── online_status (VARCHAR)         → User preference
    ├── is_online (BOOLEAN)             → Connection state
    ├── idx_players_online              → Query optimization
    └── idx_players_last_seen           → Sort optimization
```

## Data Flow Diagrams

### User Connects Flow

```
┌────────────┐
│   User A   │
│  Browser   │
└─────┬──────┘
      │ 1. WebSocket Connect
      ▼
┌────────────────────────────────────┐
│   Backend Server (Socket.IO)       │
│   socket.on('register_player')     │
└─────┬──────────────────────────────┘
      │ 2. Update Database
      ▼
┌────────────────────────────────────┐
│   Database (Supabase)              │
│   UPDATE players                   │
│   SET is_online = true             │
│   WHERE player_id = 'wallet'       │
└─────┬──────────────────────────────┘
      │ 3. Broadcast to All Clients
      ▼
┌────────────────────────────────────┐
│   Socket.IO                        │
│   io.emit('user_status_changed')   │
└─────┬──────────────────────────────┘
      │ 4. All Clients Receive Event
      ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│  User A    │  │  User B    │  │  User C    │
│  Browser   │  │  Browser   │  │  Browser   │
└─────┬──────┘  └─────┬──────┘  └─────┬──────┘
      │               │               │
      │ 5. useOnlineStatus Hook Updates
      ▼               ▼               ▼
┌────────────┐  ┌────────────┐  ┌────────────┐
│  Avatar    │  │  Avatar    │  │  Avatar    │
│  🟢 Online │  │  🟢 Online │  │  🟢 Online │
└────────────┘  └────────────┘  └────────────┘
```

### User Disconnects Flow

```
┌────────────┐
│   User A   │
│  Browser   │
│  (Closes)  │
└─────┬──────┘
      │ 1. WebSocket Disconnect
      ▼
┌────────────────────────────────────┐
│   Backend Server                   │
│   socket.on('disconnect')          │
└─────┬──────────────────────────────┘
      │ 2. Update Database
      ▼
┌────────────────────────────────────┐
│   Database (Supabase)              │
│   UPDATE players SET               │
│     is_online = false,             │
│     last_seen = NOW()              │
│   WHERE player_id = 'wallet'       │
└─────┬──────────────────────────────┘
      │ 3. Broadcast to All Clients
      ▼
┌────────────────────────────────────┐
│   Socket.IO                        │
│   io.emit('user_status_changed')   │
└─────┬──────────────────────────────┘
      │ 4. Clients Update UI
      ▼
┌────────────┐  ┌────────────┐
│  User B    │  │  User C    │
│  Browser   │  │  Browser   │
└─────┬──────┘  └─────┬──────┘
      │               │
      ▼               ▼
┌────────────┐  ┌────────────┐
│  Avatar    │  │  Avatar    │
│  ⚫ Offline│  │  ⚫ Offline│
│  Last seen │  │  Last seen │
│  1m ago    │  │  1m ago    │
└────────────┘  └────────────┘
```

### Status Preference Change Flow

```
┌────────────┐
│   User A   │
│  Browser   │
└─────┬──────┘
      │ 1. Click Status Toggle
      │    Select "Appear Offline"
      ▼
┌────────────────────────────────────┐
│   OnlineStatusToggle Component     │
│   setStatusPreference('appear_..') │
└─────┬──────────────────────────────┘
      │ 2. POST /api/user/status
      ▼
┌────────────────────────────────────┐
│   Backend API Handler              │
│   db.setUserStatusPreference()     │
└─────┬──────────────────────────────┘
      │ 3. Update Database
      ▼
┌────────────────────────────────────┐
│   Database (Supabase)              │
│   UPDATE players SET               │
│     online_status='appear_offline' │
└─────┬──────────────────────────────┘
      │ 4. Broadcast Change
      ▼
┌────────────────────────────────────┐
│   Socket.IO                        │
│   io.emit('user_status_preference  │
│           _changed')               │
└─────┬──────────────────────────────┘
      │ 5. All Clients Update
      ▼
┌────────────┐  ┌────────────┐
│  User B    │  │  User C    │
│  Browser   │  │  Browser   │
└─────┬──────┘  └─────┬──────┘
      │               │
      ▼               ▼
┌────────────┐  ┌────────────┐
│ Friends    │  │ Online     │
│ List       │  │ Users List │
│            │  │            │
│ User A     │  │ • User B   │
│ [removed]  │  │ • User C   │
│            │  │            │
│            │  │ [User A    │
│            │  │  hidden]   │
└────────────┘  └────────────┘
```

## State Management

### Database State

```sql
-- Core status fields
CREATE TABLE players (
    player_id VARCHAR(100) PRIMARY KEY,
    
    -- Online Status System
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    online_status VARCHAR(20) DEFAULT 'online',
    
    -- Other fields...
);

-- Example states:

-- User connected and visible
is_online = true
online_status = 'online'
last_seen = '2024-08-12 10:30:00'

-- User connected but hidden
is_online = true
online_status = 'appear_offline'
last_seen = '2024-08-12 10:30:00'

-- User disconnected
is_online = false
online_status = 'online'
last_seen = '2024-08-12 10:30:00'
```

### Frontend State (React)

```typescript
// useOnlineStatus hook maintains state map
interface OnlineStatusMap {
  [walletAddress: string]: {
    is_online: boolean;
    last_seen?: string;
    online_status?: 'online' | 'appear_offline';
  }
}

// Example state:
{
  '0xabc...': {
    is_online: true,
    online_status: 'online'
  },
  '0xdef...': {
    is_online: false,
    last_seen: '2024-08-12T10:30:00Z',
    online_status: 'online'
  },
  '0xghi...': {
    is_online: true,
    online_status: 'appear_offline'
  }
}
```

## WebSocket Event Protocol

### Event: register_player

```javascript
// Client → Server
socket.emit('register_player', {
  walletAddress: '0x...',
  playerName: 'Username'
});

// Server action:
// 1. Store socket-to-player mapping
// 2. Update database: is_online = true
// 3. Broadcast status change
```

### Event: user_status_changed

```javascript
// Server → All Clients
io.emit('user_status_changed', {
  walletAddress: '0x...',
  is_online: true,
  timestamp: Date.now()
});

// Client action:
// 1. Update onlineStatuses state
// 2. Trigger React re-render
// 3. UI shows updated indicator
```

### Event: user_status_preference_changed

```javascript
// Server → All Clients
io.emit('user_status_preference_changed', {
  walletAddress: '0x...',
  statusPreference: 'appear_offline',
  timestamp: Date.now()
});

// Client action:
// 1. Update status preference in state
// 2. Remove from online lists if appear_offline
// 3. Keep in friends list
```

## Query Patterns

### Get Online Users (Respecting Privacy)

```sql
SELECT 
  player_id,
  username,
  avatar_url,
  elo_rating
FROM players
WHERE 
  is_online = true                    -- Actually connected
  AND online_status != 'appear_offline' -- Not hidden
ORDER BY elo_rating DESC
LIMIT 100;
```

### Get Friend Status

```sql
SELECT 
  f.friend_id,
  p.username,
  p.is_online,
  p.last_seen,
  p.online_status
FROM friends f
JOIN players p ON f.friend_id = p.player_id
WHERE f.user_id = $1 AND f.status = 'accepted';
```

### Update User Status

```sql
-- On connect
UPDATE players 
SET is_online = true, last_active = NOW()
WHERE player_id = $1;

-- On disconnect
UPDATE players 
SET is_online = false, last_seen = NOW()
WHERE player_id = $1;
```

## Scalability Considerations

### Current Architecture (1-1000 users)

```
┌─────────────────────────────────────┐
│   Single Node.js Process            │
│   - In-memory Map<socket, player>   │
│   - Direct PostgreSQL queries       │
│   - Socket.IO broadcasts            │
└─────────────────────────────────────┘
```

### Future Scaling (1000+ users)

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Node.js   │    │  Node.js   │    │  Node.js   │
│  Server 1  │    │  Server 2  │    │  Server 3  │
└──────┬─────┘    └──────┬─────┘    └──────┬─────┘
       │                 │                 │
       └─────────┬───────┴─────────┬───────┘
                 │                 │
         ┌───────▼──────┐  ┌───────▼──────┐
         │    Redis     │  │  PostgreSQL   │
         │   Pub/Sub    │  │   Database    │
         └──────────────┘  └───────────────┘
```

## Performance Metrics

### Response Times

```
WebSocket Events:
- register_player: <10ms
- status_changed broadcast: <20ms
- UI update: <50ms

API Endpoints:
- GET /api/user/:wallet/status: <50ms
- POST /api/user/status: <100ms
- POST /api/user/heartbeat: <30ms

Database Queries:
- Get user status: <10ms (indexed)
- Get online users: <50ms (indexed)
- Update status: <20ms
```

### Bandwidth Usage

```
Per User Per Session:
- Initial connection: ~2KB
- Status broadcasts: ~200 bytes each
- Average: ~5KB per hour
- 100 users: ~500KB/hour
- 1000 users: ~5MB/hour
```

## Security Architecture

### Authentication Flow

```
┌────────────┐
│   Client   │
└─────┬──────┘
      │ 1. Connect wallet
      ▼
┌─────────────────────────┐
│  Wallet Authentication  │
│  (wagmi + Web3)         │
└─────┬───────────────────┘
      │ 2. Verified address
      ▼
┌─────────────────────────┐
│  WebSocket Connection   │
│  + wallet validation    │
└─────┬───────────────────┘
      │ 3. Authorized events
      ▼
┌─────────────────────────┐
│  Status Updates         │
│  (only own status)      │
└─────────────────────────┘
```

### Privacy Enforcement

```
Query Filter Logic:

getOnlineUsers():
  WHERE is_online = true
  AND online_status != 'appear_offline'
  ✓ Respects user preference

getFriendsList():
  // Shows all friends regardless of status
  ✓ Friends can see each other

challengeUser():
  // Can challenge even if appear_offline
  ✓ Functionality preserved
```

## Error Handling

### WebSocket Disconnection

```
Client reconnect strategy:
1. Auto-reconnect with exponential backoff
2. Re-emit register_player on reconnect
3. Fetch current statuses
4. Resume real-time updates

Server cleanup:
1. Detect disconnect event
2. Update database status
3. Broadcast to other clients
4. Clear socket mapping
```

### Database Failures

```
Graceful degradation:
1. WebSocket continues to work
2. In-memory status map used
3. Database writes queued
4. Retry on reconnect
5. UI shows "status unknown"
```

## Monitoring & Observability

### Key Metrics to Track

```
- Active WebSocket connections
- Status update latency
- Database query performance
- Broadcast message rate
- Error rate by type
- User preference distribution
```

### Logging

```javascript
// Server logs
[REGISTER] {username} registered as online (socket: {id})
[STATUS] {wallet}... → online
[STATUS] {wallet}... → offline
[BROADCAST] user_status_changed → {count} clients

// Error logs
[ERROR] Failed to update status: {error}
[WARN] Slow status query: {duration}ms
```

---

**Architecture Version**: 1.0.0  
**Last Updated**: August 2024  
**Status**: Production Ready
