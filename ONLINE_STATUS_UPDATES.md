# Online Status Updates

Real-time online status tracking for HemiChess players with WebSocket integration.

## Features

### ✅ Implemented

1. **Real-time Status Updates via WebSocket**
   - Automatic status broadcasts when users connect/disconnect
   - Instant updates across all connected clients
   - No polling required - truly real-time

2. **"Last Seen" Timestamp**
   - Displays when offline users were last active
   - Format: "Last seen 5 minutes ago"
   - Stored in database and updated on disconnect

3. **Online Status Toggle ("Appear Offline" Feature)**
   - Users can control their visibility
   - Options: Online, Appear Offline
   - Preference stored in database
   - Respects privacy while maintaining connection

4. **Online User Count in UI**
   - Live counter in navigation bar
   - Updates automatically via WebSocket
   - Shows total active players

5. **Enhanced UI Components**
   - Green pulse indicator for online users
   - Gray indicator for offline users
   - Last seen timestamp display
   - Smooth transitions and animations

## Architecture

### Database Schema

```sql
-- New columns added to players table
ALTER TABLE players 
ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN online_status VARCHAR(20) DEFAULT 'online',
ADD COLUMN is_online BOOLEAN DEFAULT FALSE;

-- Indexes for performance
CREATE INDEX idx_players_online ON players(is_online, online_status);
CREATE INDEX idx_players_last_seen ON players(last_seen DESC);
```

**Fields:**
- `last_seen`: Last time user was seen online (for "Last seen" display)
- `online_status`: User preference ('online', 'offline', 'appear_offline')
- `is_online`: Actual online state based on socket connection

### Backend Components

#### 1. Supabase Functions (`backend/supabase.js`)

```javascript
// Set user online/offline
setUserOnlineStatus(walletAddress, isOnline)

// Set status preference
setUserStatusPreference(walletAddress, statusPreference)

// Get user status
getUserOnlineStatus(walletAddress)

// Get online users (respects appear_offline)
getOnlineUsers(limit)

// Update last seen (heartbeat)
updateLastSeen(walletAddress)
```

#### 2. WebSocket Events (`backend/server.js`)

**Server → Client:**
- `user_status_changed` - Broadcast when user connects/disconnects
- `user_status_preference_changed` - Broadcast when preference changes

**Client → Server:**
- `register_player` - Register as online (auto-updates database)

#### 3. API Endpoints

```
POST /api/user/status
Body: { walletAddress, statusPreference }
Updates user's status preference

GET /api/user/:walletAddress/status
Returns: { is_online, last_seen, online_status }

POST /api/user/heartbeat
Body: { walletAddress }
Updates last_seen timestamp
```

### Frontend Components

#### 1. Custom Hooks

**`useOnlineStatus(walletAddresses[])`**
- Track real-time status of multiple users
- Auto-subscribes to WebSocket updates
- Returns: `{ isUserOnline(), getLastSeen(), loading, refetch() }`

**`useMyOnlineStatus()`**
- Manage current user's status preference
- Returns: `{ statusPreference, setStatusPreference(), updating }`

**`useOnlineCount()`**
- Track total online users
- Auto-updates via WebSocket
- Returns: `{ count, loading, refetch() }`

#### 2. UI Components

**`<OnlineStatusToggle />`**
- Dropdown menu to change status preference
- Shows current status with icon
- Updates instantly

**`<OnlineUserCount />`**
- Displays total online players
- Configurable size and icon
- Auto-refreshing

**`<Avatar showOnline={true} isOnline={bool} />`**
- Enhanced avatar with online indicator
- Green pulse for online
- Gray for offline

#### 3. Updated Components

**`<FriendsList />`**
- Shows real-time online status
- Displays "Last seen" for offline friends
- Green indicators for online friends

**`<Navbar />`**
- Online user count in header
- Status toggle button
- Responsive design

## Usage Examples

### Track Friend Status

```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function FriendsList({ friends }) {
  const wallets = friends.map(f => f.wallet_address);
  const { isUserOnline, getLastSeen } = useOnlineStatus(wallets);
  
  return friends.map(friend => (
    <div>
      <Avatar 
        showOnline={true} 
        isOnline={isUserOnline(friend.wallet_address)} 
      />
      {!isUserOnline(friend.wallet_address) && (
        <span>Last seen {formatDistanceToNow(getLastSeen(friend.wallet_address))}</span>
      )}
    </div>
  ));
}
```

### Change Status Preference

```tsx
import { useMyOnlineStatus } from '@/hooks/useOnlineStatus';

function StatusSettings() {
  const { statusPreference, setStatusPreference } = useMyOnlineStatus();
  
  return (
    <select 
      value={statusPreference} 
      onChange={e => setStatusPreference(e.target.value)}
    >
      <option value="online">Online</option>
      <option value="appear_offline">Appear Offline</option>
    </select>
  );
}
```

### Display Online Count

```tsx
import { OnlineUserCount } from '@/components/OnlineUserCount';

function Header() {
  return <OnlineUserCount size="md" showIcon={true} />;
}
```

## Performance Considerations

### WebSocket Optimization
- Single WebSocket connection per client
- Broadcasts use rooms for targeted delivery
- Automatic reconnection on disconnect

### Database Optimization
- Indexed columns for fast queries
- Batch updates for multiple status changes
- Cached online user list

### Heartbeat Strategy
- Optional heartbeat endpoint for inactive tabs
- Last seen updated on disconnect automatically
- No polling - purely event-driven

## Privacy & Security

### Status Preferences
- **Online**: Visible to everyone (default)
- **Appear Offline**: Hidden from online lists, can still play games

### Data Protection
- Status data only visible to authenticated users
- WebSocket connections validated
- Rate limiting on status updates

## Migration

To add this feature to an existing database:

```bash
# Run migration
psql $DATABASE_URL < backend/migrations/001_add_online_status.sql
```

Or manually execute:
```sql
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'online',
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_players_online ON players(is_online, online_status);
```

## Testing

### Manual Testing Steps

1. **Connect as User A**
   - Check that online count increases
   - Verify green indicator appears

2. **Connect as User B**
   - Check User A's status is online
   - Test real-time updates

3. **Change Status to "Appear Offline"**
   - Verify removed from online list
   - Check can still play games

4. **Disconnect User A**
   - Verify "Last seen" timestamp appears
   - Check online count decreases

5. **Wait 5 minutes**
   - Verify "Last seen 5 minutes ago" updates

### WebSocket Event Testing

```javascript
// Listen to status events (browser console)
const socket = io('http://localhost:3000');
socket.on('user_status_changed', data => console.log('Status:', data));
socket.on('user_status_preference_changed', data => console.log('Preference:', data));
```

## Future Enhancements

### Potential Additions
- [ ] "Away" status (auto-detect inactivity)
- [ ] Custom status messages
- [ ] Friend-only visibility option
- [ ] Typing indicators in challenges
- [ ] Rich presence (showing current game)
- [ ] Mobile push notifications for status changes
- [ ] Activity status (In Game, In Queue, Idle)

### Performance Improvements
- [ ] Redis caching for online status
- [ ] WebSocket rooms per friend group
- [ ] Presence aggregation service
- [ ] Status update debouncing

## Troubleshooting

### Status Not Updating

**Check:**
1. WebSocket connection (`getSocket().connected`)
2. User registered (`socket.emit('register_player', ...)`)
3. Database migration applied
4. Backend logs for errors

### "Last Seen" Not Displaying

**Check:**
1. Database column exists (`last_seen`)
2. User has disconnected at least once
3. Clock sync between client/server
4. Date formatting library installed

### Appear Offline Not Working

**Check:**
1. Status preference saved to database
2. `getOnlineUsers()` filters `appear_offline`
3. WebSocket broadcast sent
4. Client hook subscribed to preference changes

## Technical Details

### WebSocket Flow

```
Client Connect
  → socket.emit('register_player')
  → Server: setUserOnlineStatus(true)
  → Server: io.emit('user_status_changed')
  → All Clients: Update UI

Client Disconnect
  → Server: setUserOnlineStatus(false)
  → Server: updateLastSeen()
  → Server: io.emit('user_status_changed')
  → All Clients: Update UI
```

### Database Queries

**Get Online Users:**
```sql
SELECT * FROM players 
WHERE is_online = true 
AND online_status != 'appear_offline'
ORDER BY elo_rating DESC;
```

**Update Status:**
```sql
UPDATE players 
SET is_online = $1, last_seen = NOW() 
WHERE player_id = $2;
```

## Credits

Feature developed as part of HemiChess real-time infrastructure enhancement.

---

**Last Updated:** 2024
**Status:** ✅ Implemented and Production Ready
