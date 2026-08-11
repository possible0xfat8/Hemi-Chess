import { Link, useRouterState } from '@tanstack/react-router'
import { ConnectWallet } from './ConnectWallet'
import { ServerStatus } from './ServerStatus'
import { NotificationBell } from './NotificationBell'
import { useAccount } from 'wagmi'
import { Gamepad2, User, Shield, Trophy, Users } from 'lucide-react'

const ADMIN_WALLETS = ((import.meta.env['VITE_ADMIN_WALLETS'] as string | undefined) || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(addr => addr.length > 0)

const publicLinks = [
  { to: '/play', label: 'Play', icon: Gamepad2 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/friends', label: 'Friends', icon: Users },
] as const

const profileLink = { to: '/profile', label: 'Profile', icon: User } as const

const adminLink = { to: '/admin', label: 'Admin', icon: Shield } as const

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { address, isConnected } = useAccount()
  
  // Check if connected wallet is an admin
  const isAdmin = isConnected && address && ADMIN_WALLETS.includes(address.toLowerCase())
  
  // Show admin link only to admins
  const links = isAdmin ? [...publicLinks, adminLink] : publicLinks

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklab,var(--bg-elevated)_92%,transparent)] px-3 sm:px-5 md:px-6 py-3 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left section: Logo + Server Status */}
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <Link to="/" className="flex items-center min-w-max group shrink-0">
            <img 
              src="/hemi-chess-logo.png" 
              alt="Hemi Chess" 
              className="h-8 w-auto sm:h-9 md:h-10 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </Link>

          <ServerStatus />
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-tight transition-colors ${
                  pathname === l.to
                    ? 'bg-orange-soft text-orange'
                    : 'text-ink-muted hover:text-ink hover:bg-[var(--surface-strong)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{l.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Mobile Navigation - Icons Only */}
        <div className="md:hidden flex items-center gap-1.5 shrink-0">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center justify-center h-10 w-10 rounded-lg transition-all ${
                  pathname === l.to
                    ? 'bg-orange-soft text-orange'
                    : 'text-ink-muted hover:text-ink hover:bg-[var(--surface-strong)]'
                }`}
                title={l.label}
              >
                <Icon className="w-5 h-5" />
              </Link>
            )
          })}
        </div>

        {/* Right section: Notifications + Profile + Connect */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Notification Bell - only show when connected */}
          {isConnected && <NotificationBell />}
          
          {/* Profile link - only show when connected */}
          {isConnected && (
            <>
              {/* Desktop Profile Link */}
              <Link
                to={profileLink.to}
                className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold tracking-tight transition-colors ${
                  pathname === profileLink.to
                    ? 'bg-orange-soft text-orange'
                    : 'text-ink-muted hover:text-ink hover:bg-[var(--surface-strong)]'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{profileLink.label}</span>
              </Link>

              {/* Mobile Profile Icon */}
              <Link
                to={profileLink.to}
                className={`md:hidden flex items-center justify-center h-10 w-10 rounded-lg transition-all ${
                  pathname === profileLink.to
                    ? 'bg-orange-soft text-orange'
                    : 'text-ink-muted hover:text-ink hover:bg-[var(--surface-strong)]'
                }`}
                title={profileLink.label}
              >
                <User className="w-5 h-5" />
              </Link>
            </>
          )}
          
          <ConnectWallet />
        </div>
      </div>
    </nav>
  )
}
