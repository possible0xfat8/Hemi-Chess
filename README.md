# HemiChess - Web3 Chess on Hemi Network

A fully-featured, production-ready chess application with blockchain integration, built on the Hemi Sepolia testnet. Players compete in real-time matches with ELO ratings stored as soulbound tokens on-chain.

## 🎯 Project Overview

HemiChess is a Web3 chess platform that combines traditional chess gameplay with blockchain technology. Players connect their wallets, compete in ranked matches, and earn/lose ELO tokens that are minted or burned directly on the Hemi blockchain based on match outcomes.

### Key Features

- ✅ **Real-time Chess Gameplay** - Full chess engine with legal move validation
- ✅ **Blockchain Integration** - ELO ratings as soulbound ERC-20 tokens on Hemi Network
- ✅ **Ranked Matchmaking** - ELO-based competitive ladder system
- ✅ **Friends System** - Add friends, send match challenges, real-time notifications
- ✅ **Match History** - Persistent game records stored in Supabase
- ✅ **Live Leaderboard** - Real-time rankings based on ELO and wins
- ✅ **Oracle Settlement** - Backend oracle prevents rage-quit exploits
- ✅ **Automatic Blockchain Sync** - Batch operations for efficient ELO synchronization
- ✅ **Admin Dashboard** - Monitor server health, manage games, sync blockchain state
- ✅ **Draw System** - Players can offer/accept/decline draws during matches
- ✅ **Mobile Responsive** - Optimized UI for both desktop and mobile devices

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React + TypeScript
- TanStack Router for routing
- Viem + Wagmi for Web3 integration
- Socket.io-client for real-time gameplay
- Chess.js for game logic
- Tailwind CSS for styling

**Backend:**
- Node.js + Express
- Socket.io for WebSocket connections
- Supabase (PostgreSQL) for data persistence
- Viem for blockchain interactions
- EIP-712 for cryptographic signature verification

**Blockchain:**
- Hemi Sepolia Testnet (Chain ID: 743111)
- Custom ERC-20 soulbound token contract
- Oracle-based match settlement system

### Database Schema

**Tables:**
- `players` - User profiles, ELO ratings, stats
- `game_history` - Match records with ELO snapshots
- `friends` - Friendship relationships (pending/accepted)
- `notifications` - Real-time notification system

## 🎮 How It Works

### Match Flow

1. **Connect Wallet** - Player connects MetaMask to authenticate
2. **Queue for Match** - Enter matchmaking queue or challenge a friend
3. **Play Game** - Real-time chess with move validation and timers
4. **Sign Result** - Both players sign match result using EIP-712
5. **Oracle Settlement** - Backend verifies signatures and adjusts ELO on-chain
6. **Database Update** - Match recorded, stats updated, blockchain synced

### ELO System

- **Starting ELO**: 1200 points (minted on first game)
- **Database as Source of Truth** - ELO calculated in database
- **Blockchain Sync** - Automatic batch synchronization to keep on-chain balances in sync
- **Soulbound Tokens** - Cannot be transferred between players (only mint/burn)

### Anti-Cheat Measures

- **Dual Signature Verification** - Both players must sign match results
- **Backend Oracle** - Server validates signatures before settlement
- **No User Burns** - Losers never sign burn transactions (prevents rage-quit exploits)
- **Idempotent Settlements** - Duplicate settlements are automatically rejected

## 🚀 Recent Improvements

### Batch Blockchain Sync (Latest)

**Problem:** Syncing N players required N individual transactions, causing high gas costs and slow execution.

**Solution:** Implemented `batchAdjustElo` smart contract function that processes multiple players in a single transaction.

**Benefits:**
- 🚀 **~90% Gas Savings** - 1 transaction instead of N transactions
- ⚡ **10-100x Faster** - Single confirmation vs N confirmations
- 💪 **Atomic Operations** - All succeed or all fail together
- 🤖 **Auto-sync on Startup** - Server automatically syncs all players on launch

### Friends & Notifications System

**Features:**
- Search and add friends by username/wallet
- Send friend requests with real-time notifications
- Challenge friends to private matches
- WebSocket-based notification delivery
- Accept/decline friend requests
- Remove friends (unfriend)

### Username Persistence

**Before:** Usernames stored in browser localStorage (not persistent across devices)

**After:** Usernames stored in database, linked to wallet addresses
- Persistent across browsers and devices
- Default: Truncated wallet address (e.g., `0x8e8e...6df3`)
- Customizable through profile settings

### Match Challenge System

**Features:**
- Send match challenges to friends
- 60-second challenge expiration
- Accept/decline challenges
- Real-time WebSocket handshake
- Auto-cancel on disconnect
- Synchronized game room entry for both players
- Unranked friend matches (separate from competitive ladder)

### Draw Feature Redesign

**Improvements:**
- Visual banner for draw offer initiator
- Cancel button for pending offers
- Enhanced opponent notification with teal styling
- Clear status messages for all states
- Backend validation to prevent premature settlement

### Admin Dashboard

**Capabilities:**
- View server statistics (active games, queue size, memory usage)
- Monitor blockchain sync status
- Batch sync all players to blockchain
- Check oracle wallet balance
- Clear completed games
- Emergency game reset

## 📝 Smart Contract

### HemiChessElo.sol

**Contract Address (Hemi Sepolia):** `0xeE82E97e9B8bA9b189FcB7Dedb65Dc3717f41d79`

**Key Functions:**
- `adjustElo(address player, uint256 amount, bool isWin)` - Adjust single player ELO
- `batchAdjustElo(address[] players, uint256[] amounts, bool[] isWins)` - Batch adjust multiple players
- `balanceOf(address account)` - Read player's current ELO
- `_update()` override - Enforces soulbound token behavior (prevents transfers)

**Events:**
- `EloAdjusted(address indexed player, uint256 amount, bool isWin)` - Emitted on every ELO change

## 🔧 Setup & Configuration

### Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase)
- MetaMask or compatible Web3 wallet
- Hemi Sepolia testnet ETH for oracle wallet

### Environment Variables

**Backend (`backend/.env`):**
```env
# Admin wallet addresses (comma-separated)
ADMIN_WALLETS=0x...

# Server port
PORT=3000

# Backend oracle private key (for on-chain settlement)
BACKEND_PRIVATE_KEY=0x...

# Smart contract address
HEMI_CHESS_ELO_ADDRESS=0xeE82E97e9B8bA9b189FcB7Dedb65Dc3717f41d79

# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

**Frontend (`src/.env` or build environment):**
```env
VITE_BACKEND_URL=http://localhost:3000
VITE_ADMIN_WALLETS=0x...
```

### Database Setup

1. Create a Supabase project
2. Run migration: `backend/migrations/001_initial_schema.sql`
3. Run migration: `backend/migrations/002_friends_notifications.sql`
4. Update `.env` with Supabase credentials

### Running the Project

**Backend:**
```bash
cd backend
npm install
node server.js
```

**Frontend:**
```bash
npm install
npm run dev
```

## 🎨 UI/UX Features

### Homepage
- Hero section with game spotlight
- Quick action cards (Play, Friends, Tournaments, Leaderboards)
- User stats dashboard
- Active games list
- Bottom navigation (mobile)
- Dark theme throughout

### Game Interface
- Real-time chess board with drag-and-drop
- Move history sidebar
- Player info cards with ELO ratings
- Game timer countdown
- Draw offer system
- Resignation option
- Settlement status indicators

### Navbar
- Logo and branding
- Server status indicator
- Navigation links (Play, Leaderboard, Friends, Profile)
- Notification bell with badge
- Wallet connection button
- Admin link (for authorized wallets)

## 🔐 Security Features

- **EIP-712 Typed Data Signing** - Secure, user-friendly signature verification
- **Oracle-based Settlement** - Prevents client-side manipulation
- **Soulbound Tokens** - ELO cannot be transferred or sold
- **Admin Wallet Gating** - Restricted access to sensitive operations
- **Database Idempotency** - Prevents duplicate match settlements
- **Balance Validation** - Checks before burning to prevent underflows

## 📊 Performance Optimizations

- **Batch Blockchain Operations** - Sync multiple players in one transaction
- **Parallel Async Operations** - Non-blocking sync operations
- **WebSocket Connections** - Real-time updates without polling
- **Database Indexing** - Fast lookups by wallet address and game ID
- **Client-side Caching** - Reduced API calls with localStorage
- **Connection Pooling** - Efficient database connections via Supabase

## 🐛 Known Issues & Limitations

- Hemi Sepolia testnet can be slow (5+ minute confirmations)
- Oracle wallet needs manual ETH top-ups
- Match history limited to 100 most recent games
- Friend list capped at database query limits

## 🛣️ Roadmap

- [ ] Tournament system
- [ ] Spectator mode
- [ ] Game replay feature
- [ ] NFT achievements
- [ ] Mobile app (React Native)
- [ ] Mainnet deployment
- [ ] Multiple time control formats (bullet, blitz, rapid)
- [ ] Opening book analysis
- [ ] Post-game analysis engine

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Chess.js for chess logic
- Hemi Network for blockchain infrastructure
- OpenZeppelin for secure smart contract standards
- Supabase for database hosting
- The Web3 community for tools and support

---

**Built with ❤️ for the Hemi Network ecosystem**
