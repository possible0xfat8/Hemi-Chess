# Hemi Chess

A competitive blockchain-based chess platform built on Hemi Network with real-time gameplay and ELO rankings.

## 🚀 Quick Start

### Frontend Development
```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

### Backend Server
```bash
cd backend

# Install dependencies
npm install

# Start backend server
npm run dev
```

## 🌐 Deployment

### Backend (Railway)
Backend is deployed at: `https://hemi-chess-production.up.railway.app`

**Environment Variables Required:**
- `PORT=3000`
- `ADMIN_WALLETS` - Admin wallet addresses
- `BACKEND_PRIVATE_KEY` - Backend oracle wallet private key
- `HEMI_CHESS_ELO_ADDRESS` - Smart contract address
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME=hemi-profile-storage`
- `R2_PUBLIC_URL` - R2 public bucket URL
- `NODE_ENV=production`

### Frontend
Set `VITE_BACKEND_URL` in `.env.local` to point to your deployed backend.

## 🎮 Features

### ✅ Complete Features
- **Wallet Integration** - Web3 wallet connection with Wagmi
- **Real-time Chess** - Socket.io powered live gameplay
- **ELO Rating System** - Blockchain-backed rating with database cache
- **Avatar System** - User profile avatars with R2 storage
- **Leaderboard** - Ranked by games played and ELO rating
- **Friends System** - Add friends and challenge them
- **Admin Panel** - Admin-only game management
- **Welcome Modal** - First-time user onboarding
- **$HELO Explanation** - Beginner-friendly blockchain explanation (? icon in navbar)
- **Settlement Toasts** - Simplified post-game notifications

### 🎨 UI Components
- Avatar component with fallback
- Welcome modal with 3-step carousel
- HELO explanation modal
- Settlement toasts
- Notification bell
- Server status indicator

### 🗄️ Database
- Supabase PostgreSQL
- Tables: users, games, user_stats, friends
- Migration: `backend/migrations/003_add_avatar_url.sql` (run in Supabase console)

### 📦 Storage
- Cloudflare R2 for avatar uploads
- Sharp for image processing (400×400 JPEG)
- Public bucket: `https://pub-a89b1c48c94f4548bb1ae2e59dc57973.r2.dev`

## 🔧 Tech Stack

**Frontend:**
- TanStack Start (React framework)
- Vite
- TypeScript
- Tailwind CSS
- Wagmi (Web3)
- Socket.io Client
- React Chessboard

**Backend:**
- Node.js + Express
- Socket.io Server
- Supabase (Database)
- Viem (Ethereum)
- Cloudflare R2 (Storage)
- Sharp (Image processing)

**Blockchain:**
- Hemi Network (EVM-compatible)
- Smart Contract: HemiChessElo

## 📝 Important Notes

### ELO Rating Display
The ELO rating is displayed in the navbar (top-right) with a help icon (?). Click the icon to learn about the $HELO blockchain system.

### Leaderboard Sorting
Players with `total_games > 0` are prioritized above players with 0 games, then sorted by ELO and wins.

### Settlement Process
Post-game settlements happen in the background with beginner-friendly notifications:
- "Updating your ranking..." (pending)
- "Rank Updated! 🏆" (complete)

## 🏗️ Project Structure

```
neat-nomad-site/
├── backend/              # Express + Socket.io backend
│   ├── server.js        # Main server file
│   ├── supabase.js      # Database queries
│   ├── gameManager.js   # Game logic
│   └── migrations/      # Database migrations
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom hooks
│   ├── routes/          # TanStack Router routes
│   └── lib/             # Utilities
├── public/              # Static assets
└── .env.local          # Frontend environment variables
```

## 🔐 Environment Setup

### Frontend `.env.local`
```env
VITE_BACKEND_URL=https://hemi-chess-production.up.railway.app
VITE_ADMIN_WALLETS=0x8e8e39D67D227E0a8B10095e07EA020D53926df3
```

### Backend `.env`
See `backend/.env.example` for full list of required variables.

## 🐛 Troubleshooting

### ELO Rating Not Showing
- Make sure wallet is connected
- Check that `EloBalance` component is imported in `Navbar.tsx`
- Verify user stats are loading from database

### Backend Connection Failed
- Check `VITE_BACKEND_URL` in frontend `.env.local`
- Verify backend is running and accessible
- Check CORS configuration in `backend/server.js`

### Avatar Upload Not Working
- Verify R2 credentials in backend `.env`
- Check R2 bucket permissions
- Ensure Sharp is installed: `npm install sharp`

## 📄 License

MIT

## 🙏 Acknowledgments

Built with Hemi Network for on-chain ELO ratings with zero gas fees.
