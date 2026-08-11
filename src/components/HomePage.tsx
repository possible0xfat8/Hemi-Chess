import { Link } from '@tanstack/react-router'
import { useAccount } from 'wagmi'
import {
  Zap,
  Users,
  Trophy,
  BarChart3,
  Gamepad2,
  Home,
  User,
  Plus,
  ChevronRight,
  TrendingUp,
  Star,
  Crown,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBackendUrl } from '@/lib/config'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import { Avatar } from '@/components/Avatar'
import heroChess from '@/assets/hero-chess.jpg'

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
  opponent_avatar?: string
  your_turn: boolean
  time_remaining: number
}

const QUICK_ACTIONS = [
  {
    to: '/play',
    icon: Zap,
    title: 'Quick Match',
    sub: 'Find an opponent instantly',
    tone: 'text-orange',
    ring: 'bg-orange-soft',
    hover: 'hover:border-orange/40',
  },
  {
    to: '/friends',
    icon: Users,
    title: 'Friends',
    sub: 'Challenge your friends',
    tone: 'text-orange',
    ring: 'bg-orange-soft',
    hover: 'hover:border-orange/40',
  },
  {
    to: null,
    icon: Trophy,
    title: 'Tournaments',
    sub: 'Compete and win rewards',
    tone: 'text-orange',
    ring: 'bg-orange-soft',
    hover: '',
  },
  {
    to: '/leaderboard',
    icon: BarChart3,
    title: 'Leaderboards',
    sub: "See who's on top",
    tone: 'text-orange',
    ring: 'bg-orange-soft',
    hover: 'hover:border-orange/40',
  },
] as const

const BOTTOM_NAV = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/play', icon: Gamepad2, label: 'Play' },
  { to: '/leaderboard', icon: Trophy, label: 'Tournaments' },
  { to: '/friends', icon: Users, label: 'Friends' },
  { to: '/profile', icon: User, label: 'Profile' },
] as const

export function HomePage() {
  const { address, isConnected } = useAccount()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [activeGames] = useState<ActiveGame[]>([
    {
      game_id: '1',
      opponent_name: 'DarkKnight',
      opponent_elo: 1523,
      your_turn: true,
      time_remaining: 900,
    },
    {
      game_id: '2',
      opponent_name: 'IronBishop',
      opponent_elo: 1498,
      your_turn: false,
      time_remaining: 720,
    },
  ])

  useEffect(() => {
    if (!isConnected || !address) return
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${getBackendUrl()}/api/users/${address}/stats`)
        if (!response.ok) return
        const data = (await response.json()) as UserStats
        if (!cancelled) setStats(data)
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isConnected, address])

  const handleQuickMatch = () => {
    window.location.href = '/play'
  }

  const handleCreateRoom = () => {
    window.location.href = '/play'
  }

  const statItems = [
    {
      icon: Crown,
      tone: 'text-ink',
      value: stats ? String(stats.total_games) : '—',
      label: 'Games Played',
    },
    {
      icon: TrendingUp,
      tone: 'text-teal',
      value: stats ? `${Math.round(stats.win_rate)}%` : '—',
      label: 'Win Rate',
    },
    {
      icon: Trophy,
      tone: 'text-blue',
      value: stats ? String(stats.elo_rating) : '—',
      label: 'Rating',
    },
    {
      icon: Star,
      tone: 'text-orange',
      value: stats ? String(Math.max(stats.wins, 0)) : '—',
      label: 'Win Streak',
    },
  ]

  return (
    <div className="min-h-screen bg-canvas pb-24 md:pb-10 flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl space-y-4 px-3 pt-4 sm:px-5 sm:space-y-5 flex-1">
        {/* HERO */}
        <section className="surface relative overflow-hidden p-0">
          <div className="pointer-events-none absolute inset-0">
            <img
              src={heroChess}
              width={1536}
              height={768}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-base)] via-[color-mix(in_oklab,var(--bg-base)_62%,transparent)] to-transparent" />
          </div>

          <div className="relative z-10 flex min-h-[240px] flex-col justify-center gap-4 p-5 sm:min-h-[280px] sm:p-8">
            <div className="max-w-[19rem] sm:max-w-md">
              <h1 className="text-[1.75rem] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl">
                Play. Strategize.
                <br />
                <span className="text-orange">Dominate.</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
                Challenge players worldwide and climb the leaderboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={handleQuickMatch}
                disabled={!isConnected}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-sm font-bold text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Gamepad2 className="h-4 w-4" />
                Play Now
              </button>

              <button
                onClick={handleCreateRoom}
                disabled={!isConnected}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-[var(--surface-strong)] px-5 text-sm font-bold text-ink backdrop-blur-sm transition-colors hover:border-orange/40 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Create Room
              </button>
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon
            const inner = (
              <div className="flex h-full items-center gap-3 text-left sm:flex-col sm:items-center sm:gap-2 sm:text-center">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full sm:h-11 sm:w-11 ${a.ring}`}>
                  <Icon className={`h-5 w-5 ${a.tone}`} />
                </div>
                <div className="min-w-0 sm:contents">
                  <h3 className="truncate text-sm font-bold leading-tight text-ink">{a.title}</h3>
                  <p className="truncate text-[11px] leading-snug text-ink-muted sm:whitespace-normal sm:text-xs">{a.sub}</p>
                </div>
              </div>
            )
            return a.to ? (
              <Link
                key={a.title}
                to={a.to}
                className={`surface-inset p-3.5 transition-colors sm:p-4 ${a.hover}`}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={a.title}
                aria-disabled="true"
                className="surface-inset cursor-not-allowed p-3.5 opacity-50 sm:p-4"
              >
                {inner}
              </div>
            )
          })}
        </section>

        {/* STATS */}
        <section className="surface p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="truncate text-base font-bold text-ink sm:text-lg">Your Stats</h2>
            <Link
              to="/profile"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-orange transition-opacity hover:opacity-80 sm:text-sm"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-4 divide-x divide-[var(--surface-border)] border-t border-line pt-4">
            {statItems.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="flex flex-col items-center gap-1 px-1 text-center">
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                  <span className="text-xl font-extrabold text-ink sm:text-2xl">{s.value}</span>
                  <span className="text-[10px] leading-tight text-ink-muted sm:text-xs">
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>

          {!isConnected && (
            <p className="mt-4 text-center text-xs text-ink-faint">
              Connect your wallet to track your rating and match history.
            </p>
          )}
        </section>

        {/* ACTIVE GAMES */}
        {isConnected && activeGames.length > 0 && (
          <section className="surface p-4 sm:p-5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate text-base font-bold text-ink sm:text-lg">Active Games</h2>
              <Link
                to="/play"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-orange transition-opacity hover:opacity-80 sm:text-sm"
              >
                See All
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 space-y-2.5 border-t border-line pt-4">
              {activeGames.map((game) => (
                <Link
                  key={game.game_id}
                  to="/play"
                  className="surface-inset grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 transition-colors hover:border-orange/40 active:scale-[0.99] sm:p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <Avatar
                        src={game.opponent_avatar}
                        alt={game.opponent_name}
                        size="md"
                        fallbackText={game.opponent_name}
                      />
                      {game.your_turn && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--bg-elevated)] bg-teal" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{game.opponent_name}</p>
                      <p className="text-xs font-semibold text-orange">{game.opponent_elo}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-xs font-bold ${game.your_turn ? 'text-teal' : 'text-ink-muted'}`}
                    >
                      {game.your_turn ? 'Your Turn' : "Opponent's Turn"}
                    </p>
                    <p className="font-mono text-sm tabular-nums text-ink">
                      {Math.floor(game.time_remaining / 60)}:
                      {(game.time_remaining % 60).toString().padStart(2, '0')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-[color-mix(in_oklab,var(--bg-elevated)_94%,transparent)] backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon
            const active = item.to === '/'
            return (
              <Link
                key={item.label}
                to={item.to}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1"
              >
                <Icon className={`h-5 w-5 ${active ? 'text-orange' : 'text-ink-faint'}`} />
                <span
                  className={`truncate text-[10px] font-semibold ${active ? 'text-orange' : 'text-ink-faint'}`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
