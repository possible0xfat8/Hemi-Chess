# Online Status & Clickable Username Updates

## Overview
Added online status indicators to user avatars across the application and made all username mentions clickable to navigate to user profiles.

## New Components

### 1. **ClickableUsername Component** (`src/components/ClickableUsername.tsx`)
- Reusable component that makes usernames clickable
- Navigates to `/user/$address` when clicked
- Shows hover effect for better UX
- Props:
  - `username`: Display name
  - `walletAddress`: For navigation
  - `className`: Optional styling
  - `children`: Optional custom content

### 2. **Enhanced Avatar Component** (`src/components/Avatar.tsx`)
- Added online status indicator support
- New props:
  - `showOnline`: Boolean to enable/disable online indicator
  - `isOnline`: Boolean to show online (green pulsing) or offline (gray)
- Online indicator sizes adapt to avatar size (xs, sm, md, lg, xl)
- Positioned at bottom-right with ring border for visibility

## Updated Components

### 1. **FriendsList** (`src/components/FriendsList.tsx`)
- ✅ Added online indicators to friend avatars
- ✅ Added online indicators to search results
- ✅ Made usernames clickable in both friends list and search results
- ✅ Updated interfaces to include `online?: boolean` field

### 2. **NotificationBell** (`src/components/NotificationBell.tsx`)
- ✅ Made sender usernames clickable in all notification types:
  - Friend requests
  - Match challenges
  - Friend accepted notifications
- Usernames now navigate to sender's profile when clicked

### 3. **HomePage** (`src/components/HomePage.tsx`)
- ✅ Made opponent names clickable in active games section
- ✅ Added optional wallet address to ActiveGame interface
- Conditionally renders clickable username if wallet address is available

### 4. **OnlineUsers** (`src/components/game/OnlineUsers.tsx`)
- ✅ Added online indicators to all online user avatars (always green/pulsing)
- ✅ Made usernames clickable to navigate to user profiles
- Fixed import to use correct Avatar component

### 5. **UserProfileClient** (`src/components/game/UserProfileClient.tsx`)
- ✅ Added online status checking via `/api/users/online` endpoint
- ✅ Shows online indicator on profile avatar
- ✅ Checks online status on component mount

### 6. **ProfileClient** (`src/components/game/ProfileClient.tsx`)
- ✅ Added online indicator to user's own profile avatar
- Shows as always online (isOnline={true}) for own profile

### 7. **Leaderboard** (`src/components/Leaderboard.tsx`)
- ✅ Added online indicators to avatars in both desktop table and mobile card views
- ✅ Updated LeaderboardEntry interface to include `online?: boolean`
- Already had clickable rows - no changes needed

### 8. **ProfileCard** (`src/components/ProfileCard.tsx`)
- ✅ Added online indicator to navbar profile card (both desktop and mobile)
- Shows as always online for logged-in user

## Features

### Online Status Indicators
- **Visual Design**: Small circular indicator at bottom-right of avatar
- **Online State**: Teal/green color with pulsing animation
- **Offline State**: Gray/muted color, no animation
- **Sizes**: Automatically scales with avatar size (1.5px to 5px diameter)
- **Ring Border**: White/canvas-colored ring for contrast

### Clickable Usernames
- **Hover Effect**: Color changes to orange on hover
- **Navigation**: Routes to `/user/$address` profile page
- **Accessibility**: Includes title attribute with "View {username}'s profile"
- **Consistent**: Works across all components (friends, notifications, leaderboard, etc.)

## Implementation Details

### Online Status Data Flow
1. Backend `/api/users/online` endpoint returns list of online players
2. Components either:
   - Fetch online users directly (OnlineUsers, UserProfileClient)
   - Receive online status from API responses (FriendsList, Leaderboard)
3. Avatar component shows indicator based on `isOnline` prop

### Navigation Pattern
- Uses `useNavigate` from `@tanstack/react-router`
- Consistent route: `/user/$address` where address is wallet address
- Prevents event bubbling with `e.stopPropagation()`

## Files Modified
1. `src/components/Avatar.tsx` - Added online indicator
2. `src/components/ClickableUsername.tsx` - NEW component
3. `src/components/FriendsList.tsx` - Online indicators + clickable usernames
4. `src/components/NotificationBell.tsx` - Clickable sender usernames
5. `src/components/HomePage.tsx` - Clickable opponent names
6. `src/components/game/OnlineUsers.tsx` - Online indicators + clickable usernames
7. `src/components/game/UserProfileClient.tsx` - Online status on profile
8. `src/components/game/ProfileClient.tsx` - Online status on own profile
9. `src/components/Leaderboard.tsx` - Online indicators in table/cards
10. `src/components/ProfileCard.tsx` - Online indicator in navbar

## Testing Checklist
- [ ] Avatar online indicators visible at all sizes
- [ ] Online indicator animates (pulsing) when user is online
- [ ] Clicking usernames navigates to correct profile page
- [ ] Hover effects work on clickable usernames
- [ ] Online status updates in real-time (or on refresh)
- [ ] Profile pages show correct online status
- [ ] Navbar profile card shows online indicator
- [ ] Friends list shows online/offline status correctly
- [ ] Notifications have clickable sender names
- [ ] Leaderboard shows online indicators (both desktop/mobile)
- [ ] Active games show clickable opponent names (when wallet available)

## Future Enhancements
- Real-time online status updates via WebSocket
- "Last seen" timestamp for offline users
- Online status toggle (appear offline feature)
- Online user count in UI
