# Online Status - Quick Start Guide

Quick reference for implementing and using the online status feature.

## Setup (One-Time)

### 1. Database Migration

Run the migration to add required columns:

```bash
# Using psql
psql $DATABASE_URL < backend/migrations/001_add_online_status.sql

# Or run manually
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS online_status VARCHAR(20) DEFAULT 'online',
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
```

### 2. Backend Setup

Already configured in:
- `backend/supabase.js` - Database functions
- `backend/server.js` - WebSocket events and API endpoints

### 3. Frontend Setup

Import components where needed:

```tsx
import { useOnlineStatus, useMyOnlineStatus, useOnlineCount } from '@/hooks/useOnlineStatus';
import { OnlineStatusToggle } from '@/components/OnlineStatusToggle';
import { OnlineUserCount } from '@/components/OnlineUserCount';
```

## Common Use Cases

### Show Online Status in a List

```tsx
function PlayerList({ players }) {
  const wallets = players.map(p => p.wallet_address);
  const { isUserOnline, getLastSeen } = useOnlineStatus(wallets);
  
  return players.map(player => (
    <div key={player.id}>
      <Avatar 
        src={player.avatar}
        showOnline={true}
        isOnline={isUserOnline(player.wallet_address)}
      />
      <span>{player.username}</span>
      {!isUserOnline(player.wallet_address) && getLastSeen(player.wallet_address) && (
        <span className="text-sm text-gray-500">
          Last seen {formatDistanceToNow(new Date(getLastSeen(player.wallet_address)))}
        </span>
      )}
    </div>
  ));
}
```

### Add Status Toggle to Settings

```tsx
import { OnlineStatusToggle } from '@/components/OnlineStatusToggle';

function Settings() {
  return (
    <div>
      <h3>Visibility</h3>
      <OnlineStatusToggle />
    </div>
  );
}
```

### Display Online Count

```tsx
import { OnlineUserCount } from '@/components/OnlineUserCount';

function Header() {
  return (
    <div className="header">
      <Logo />
      <OnlineUserCount size="md" showIcon={true} />
    </div>
  );
}
```

### Check Single User Status

```tsx
function UserProfile({ walletAddress }) {
  const { isUserOnline, getLastSeen } = useOnlineStatus([walletAddress]);
  
  return (
    <div>
      {isUserOnline(walletAddress) ? (
        <span className="text-green-500">● Online</span>
      ) : (
        <span className="text-gray-500">
          Last seen {formatDistanceToNow(new Date(getLastSeen(walletAddress)))}
        </span>
      )}
    </div>
  );
}
```

### Manage Own Status

```tsx
function MyStatusControl() {
  const { statusPreference, setStatusPreference, updating } = useMyOnlineStatus();
  
  return (
    <div>
      <label>Your Status</label>
      <select 
        value={statusPreference}
        onChange={(e) => setStatusPreference(e.target.value)}
        disabled={updating}
      >
        <option value="online">Online</option>
        <option value="appear_offline">Appear Offline</option>
      </select>
    </div>
  );
}
```

## API Reference

### Hooks

#### `useOnlineStatus(walletAddresses[])`
Returns:
- `isUserOnline(wallet)` - Check if user is online
- `getLastSeen(wallet)` - Get last seen timestamp
- `onlineStatuses` - Full status map
- `loading` - Initial loading state
- `refetch()` - Manually refresh statuses

#### `useMyOnlineStatus()`
Returns:
- `statusPreference` - Current preference ('online', 'appear_offline')
- `setStatusPreference(pref)` - Update preference
- `updating` - Loading state

#### `useOnlineCount()`
Returns:
- `count` - Number of online users
- `loading` - Loading state
- `refetch()` - Manually refresh count

### Components

#### `<OnlineStatusToggle />`
Dropdown menu for changing status preference. No props needed.

#### `<OnlineUserCount />`
Props:
- `size?: 'sm' | 'md' | 'lg'` - Text size
- `showIcon?: boolean` - Show Users icon
- `className?: string` - Additional CSS classes

#### `<Avatar />`
Enhanced props:
- `showOnline?: boolean` - Show online indicator
- `isOnline?: boolean` - Online status
- All existing Avatar props

## WebSocket Events

### Client Receives

```tsx
socket.on('user_status_changed', (data) => {
  // { walletAddress, is_online, timestamp }
});

socket.on('user_status_preference_changed', (data) => {
  // { walletAddress, statusPreference, timestamp }
});
```

### Client Sends

```tsx
socket.emit('register_player', {
  walletAddress: '0x...',
  playerName: 'username'
});
```

## Backend API

### Update Status Preference
```
POST /api/user/status
Body: { walletAddress, statusPreference }
Response: { success: true }
```

### Get User Status
```
GET /api/user/:walletAddress/status
Response: { is_online, last_seen, online_status }
```

### Heartbeat (Optional)
```
POST /api/user/heartbeat
Body: { walletAddress }
Response: { success: true }
```

## Status Preferences

| Preference | Visible in Online List | Can Receive Challenges | Can Play Games |
|------------|----------------------|----------------------|----------------|
| `online` | ✅ Yes | ✅ Yes | ✅ Yes |
| `appear_offline` | ❌ No | ✅ Yes | ✅ Yes |

## Styling

### Online Indicator Colors

```css
.online-indicator {
  /* Green pulse for online */
  background: rgb(34 197 94);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.offline-indicator {
  /* Gray for offline */
  background: rgb(156 163 175);
}
```

### Avatar with Status

```tsx
<div className="relative">
  <Avatar src={src} />
  {showOnline && (
    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
      isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
    }`} />
  )}
</div>
```

## Debugging

### Check WebSocket Connection

```javascript
// In browser console
import { getSocket } from '@/lib/socket';
const socket = getSocket();
console.log('Connected:', socket.connected);
```

### Test Status Updates

```javascript
// Send status change
socket.emit('register_player', {
  walletAddress: '0x...',
  playerName: 'Test User'
});

// Listen for broadcasts
socket.on('user_status_changed', console.log);
```

### Check Database

```sql
-- View all online users
SELECT player_id, username, is_online, online_status, last_seen 
FROM players 
WHERE is_online = true;

-- View recent activity
SELECT player_id, username, last_seen 
FROM players 
ORDER BY last_seen DESC 
LIMIT 10;
```

## Best Practices

### ✅ Do

- Use `useOnlineStatus` for lists of users
- Respect `appear_offline` preference in UI
- Show "Last seen" for offline users
- Update status on connect/disconnect
- Use Avatar component's built-in indicators

### ❌ Don't

- Poll for status updates (use WebSocket events)
- Show online status of users with `appear_offline`
- Update last_seen too frequently (handled automatically)
- Display exact timestamps (use relative time)
- Expose raw online status data

## Performance Tips

1. **Batch Status Checks**: Pass array to `useOnlineStatus` instead of multiple calls
2. **Lazy Load**: Only track status for visible users
3. **Debounce Updates**: UI already handles this via WebSocket
4. **Cache Counts**: `useOnlineCount` auto-caches for 30s

## Troubleshooting

### Status not updating?
1. Check WebSocket connection
2. Verify `register_player` was called
3. Check browser console for errors

### "Last seen" showing wrong time?
1. Verify server timezone
2. Check `date-fns` is installed
3. Ensure `formatDistanceToNow` is imported

### Appear offline not working?
1. Check status preference saved
2. Verify database query filters correctly
3. Check WebSocket broadcast received

## Migration Checklist

- [ ] Run database migration
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Test WebSocket events
- [ ] Verify status toggle works
- [ ] Check online count displays
- [ ] Test "Last seen" timestamps
- [ ] Verify "Appear offline" privacy

---

For detailed documentation, see `ONLINE_STATUS_UPDATES.md`
