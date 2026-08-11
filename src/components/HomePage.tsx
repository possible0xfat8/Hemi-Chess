import { Link } from '@tanstack/react-router'
import { useAccount } from 'wagmi'
import { Zap, Users, Trophy, BarChart3, Gamepad2, Home, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBackendUrl } from '@/lib/config'
import { Navbar } from '@/components/Navbar'

interface UserStats {
  elo_rating: number
  wins: number
  losses: number
  draws: number
  total_games: number
  win_rate: number
}

interface ActiveGame {
  game_id: string
  opponent_name: string
  opponent_elo: number
  your_turn: boolean
  time_remaining: number
}

export function HomePage() {
  const { address, isConnected } = useAccount()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [activeGames] = useState<ActiveGame[]>([
    {
      game_id: '1',
      opponent_name: 'DarkKnight',
      opponent_elo: 1523,
      your_turn: true,
      time_remaining: 900
    },
    {
      game_id: '2',
      opponent_name: 'IronBishop',
      opponent_elo: 1498,
      your_turn: false,
      time_remaining: 720
    }
  ])

  useEffect(() => {
    if (isConnected && address) {
      fetchUserStats()
    }
  }, [isConnected, address])

  const fetchUserStats = async () => {
    if (!address) return
    
    try {
      const response = await fetch(`${getBackendUrl()}/api/users/${address}/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const handleQuickMatch = () => {
    window.location.href = '/play'
  }

  const handleCreateRoom = () => {
    console.log('Create room')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-16 md:pb-6">
      {/* Use existing Navbar component */}
      <Navbar />

      <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4 space-y-4 sm:space-y-5">
        
        {/* HERO SECTION */}
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl" style={{ minHeight: '220px' }}>
          <div className="absolute inset-0">
            <img 
              src="/spotlight image.png" 
              alt="Chess" 
              className="w-full h-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          </div>
          
          <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-6" style={{ minHeight: '220px' }}>
            <div className="space-y-3 max-w-xs sm:max-w-md">
              <div className="space-y-0.5">
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Play. Strategize.
                </h1>
                <h1 className="text-2xl sm:text-3xl font-bold text-orange leading-tight">
                  Dominate.
                </h1>
              </div>
              
              <p className="text-xs sm:text-sm text-gray-300">
                Challenge players worldwide and climb the leaderboard.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleQuickMatch}
                  disabled={!isConnected}
                  className="flex items-center justify-center gap-2 h-10 px-4 bg-orange hover:bg-orange/90 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Play Now
                </button>
                
                <button
                  onClick={handleCreateRoom}
                  disabled={!isConnected}
                  className="flex items-center justify-center gap-2 h-10 px-4 bg-white/10 hover:bg-white/15 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 text-white text-sm font-semibold rounded-lg transition-all backdrop-blur-sm"
                >
                  <Users className="w-4 h-4" />
                  Create Room
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTION CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <Link
            to="/play"
            className="bg-[#1a1a1a] border border-white/5 hover:border-orange/30 rounded-xl p-4 transition-all"
          >
            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange/30 to-orange/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">Quick Match</h3>
                <p className="text-xs text-gray-400">Find opponent instantly</p>
              </div>
            </div>
          </Link>

          <Link
            to="/friends"
            className="bg-[#1a1a1a] border border-white/5 hover:border-cyan-500/30 rounded-xl p-4 transition-all"
          >
            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">Friends</h3>
                <p className="text-xs text-gray-400">Challenge friends</p>
              </div>
            </div>
          </Link>

          <button
            disabled
            className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 opacity-50 cursor-not-allowed"
          >
            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">Tournaments</h3>
                <p className="text-xs text-gray-400">Compete for rewards</p>
              </div>
            </div>
          </button>

          <Link
            to="/leaderboard"
            className="bg-[#1a1a1a] border border-white/5 hover:border-purple-500/30 rounded-xl p-4 transition-all"
          >
            <div className="flex flex-col items-center text-center space-y-2.5">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">Leaderboards</h3>
                <p className="text-xs text-gray-400">See who's on top</p>
              </div>
            </div>
          </Link>
        </div>

        {/* YOUR STATS SECTION */}
        {isConnected && stats && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Your Stats</h2>
              <Link
                to="/profile"
                className="text-xs font-semibold text-orange hover:text-orange/80 transition-colors"
              >
                View All →
              </Link>
            </div>

            <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-white">
                    {stats.total_games}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <span className="text-sm">♟</span>
                    Games Played
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-cyan-400">
                    {Math.round(stats.win_rate)}%
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <span className="text-cyan-400 text-sm">↗</span>
                    Win Rate
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-blue-400">
                    {stats.elo_rating}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <Trophy className="w-3 h-3 text-blue-400" />
                    Rating
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-purple-400">
                    {Math.max(stats.wins, 0)}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <span className="text-purple-400 text-sm">★</span>
                    Win Streak
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-5 text-center space-y-2">
            <h3 className="text-sm font-semibold text-white">Connect Your Wallet</h3>
            <p className="text-xs text-gray-400">
              Connect your wallet to start playing and track your stats
            </p>
          </div>
        )}

        {/* ACTIVE GAMES SECTION */}
        {isConnected && activeGames.length > 0 && (
          <div className="space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Active Games</h2>
              <button className="text-xs font-semibold text-orange hover:text-orange/80 transition-colors">
                See All →
              </button>
            </div>

            <div className="space-y-2.5">
              {activeGames.map((game) => (
                <Link
                  key={game.game_id}
                  to="/play"
                  className="block bg-[#1a1a1a] border border-white/5 hover:border-orange/30 rounded-xl p-4 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-base font-semibold border-2 border-white/10">
                          {game.opponent_name.charAt(0)}
                        </div>
                        <div className="absolute bottom-0 right-0 h-3 w-3 bg-cyan-400 rounded-full border-2 border-[#1a1a1a]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-white text-sm">
                            {game.opponent_name}
                          </span>
                          <span className="text-xs text-orange font-semibold">
                            {game.opponent_elo}
                          </span>
                        </div>
                        {game.your_turn ? (
                          <div className="text-xs text-cyan-400 font-semibold">Your Turn</div>
                        ) : (
                          <div className="text-xs text-gray-400">Opponent's Turn</div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-mono text-white">
                        {Math.floor(game.time_remaining / 60)}:{(game.time_remaining % 60).toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PREMIUM BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#141414]/95 backdrop-blur-xl border-t border-white/5 md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-orange/20">
              <Home className="w-4.5 h-4.5 text-orange" />
            </div>
            <span className="text-[10px] font-semibold text-orange">Home</span>
          </Link>
          
          <Link
            to="/play"
            className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1"
          >
            <div className="flex items-center justify-center h-9 w-9">
              <Gamepad2 className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <span className="text-[10px] font-medium text-gray-500">Play</span>
          </Link>
          
          <Link
            to="/leaderboard"
            className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1"
          >
            <div className="flex items-center justify-center h-9 w-9">
              <Trophy className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <span className="text-[10px] font-medium text-gray-500">Tournaments</span>
          </Link>
          
          <Link
            to="/friends"
            className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1"
          >
            <div className="flex items-center justify-center h-9 w-9">
              <Users className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <span className="text-[10px] font-medium text-gray-500">Friends</span>
          </Link>
          
          <Link
            to="/profile"
            className="flex flex-col items-center justify-center gap-1 min-w-0 flex-1"
          >
            <div className="flex items-center justify-center h-9 w-9">
              <User className="w-4.5 h-4.5 text-gray-500" />
            </div>
            <span className="text-[10px] font-medium text-gray-500">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
