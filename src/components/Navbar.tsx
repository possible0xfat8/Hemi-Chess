import { Link, useRouterState } from '@tanstack/react-router'
import { ConnectWallet } from './ConnectWallet'
import { ServerStatus } from './ServerStatus'
import { NotificationBell } from './NotificationBell'
import { ProfileCard } from './ProfileCard'
import { OnlineUserCount } from './OnlineUserCount'
import { useAccount } from 'wagmi'
import { Gamepad2, Shield, Trophy, Users } from 'lucide-react'

const ADMIN_WALLETS = ((import.meta.env['VITE_ADMIN_WALLETS'] as string | undefined) || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(addr => addr.length > 0)

const publicLinks = [
  { to: '/play', label: 'Play', icon: Gamepad2 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/friends', label: 'Friends', icon: Users },
] as const

export function Navbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { address, isConnected } = useAccount()
  
  // Check if connected wallet is an admin
  const isAdmin = isConnected && address && ADMIN_WALLETS.includes(address.toLowerCase())

  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[color-mix(in_oklab,var(--bg-elevated)_92%,transparent)] px-3 sm:px-5 md:px-6 py-3 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 md:gap-4">
        
        {/* Left section: Logo + Server Status */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5 min-w-0">
          <Link to="/" className="flex items-center min-w-max group shrink-0">
            <img 
              src="/hemi-chess-logo.png" 
              alt="Hemi Chess" 
              className="h-8 w-auto sm:h-9 md:h-10 object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            />
          </Link>

          <ServerStatus />
          
          {/* Online User Count - Desktop Only */}
          <div className="hidden lg:block">
            <OnlineUserCount size="sm" />
          </div>
        </div>

        {/* Center Navigation - Desktop Only */}
        <div className="hidden md:flex items-center gap-1.5 flex-1 justify-center max-w-md">
          {publicLinks.map((l) => {
            const Icon = l.icon
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-colors ${
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
          
          {/* Admin link - icon only on desktop navbar, no text */}
          {isAdmin && (
            <Link
              to="/admin"
              className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                pathname === '/admin'
                  ? 'bg-orange-soft text-orange'
                  : 'text-ink-muted hover:text-ink hover:bg-[var(--surface-strong)]'
              }`}
              title="Admin Panel"
            >
              <Shield className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Right section: Notifications + Profile Card + Connect */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Notification Bell - only show when connected */}
          {isConnected && <NotificationBell />}
          
          {/* Profile Card - only show when connected */}
          {isConnected && (
            <ProfileCard 
              isActive={pathname === '/profile'}
              isAdmin={isAdmin}
            />
          )}
          
          {/* Connect Wallet Button */}
          <ConnectWallet />
        </div>

      </div>
    </nav>
  )
}
