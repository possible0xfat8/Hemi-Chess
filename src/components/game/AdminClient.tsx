import { getBackendUrl } from '@/lib/config'
import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/Navbar'
import { BlockchainSyncPanel } from '@/components/admin/BlockchainSyncPanel'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'

const ADMIN_WALLETS = ((import.meta.env['VITE_ADMIN_WALLETS'] as string | undefined) || '')
  .split(',')
  .map(addr => addr.trim().toLowerCase())
  .filter(addr => addr.length > 0)

export function AdminClient() {
  const { address, isConnected } = useAccount()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeGames: 0,
    queueSize: 0,
    connectedSockets: 0,
    uptime: 0,
    memory: 0
  })
  const [loading, setLoading] = useState(true)

  const isAdmin = isConnected && address && ADMIN_WALLETS.includes(address.toLowerCase())

  useEffect(() => {
    if (isAdmin) {
      loadStats()
      const interval = setInterval(loadStats, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
    return undefined
  }, [isAdmin])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      // Fetch health stats
      const healthRes = await fetch(`${getBackendUrl()}/health`)
      const health = await healthRes.json()
      
      // Fetch user count
      const usersRes = await fetch(`${getBackendUrl()}/api/users/count`)
      const users = await usersRes.json()
      
      setStats({
        totalUsers: users.count || 0,
        activeGames: health.activeGames || 0,
        queueSize: health.queueSize || 0,
        connectedSockets: health.connectedSockets || 0,
        uptime: Math.floor(health.uptime / 3600) || 0,
        memory: Math.round(health.memory?.heapUsed / 1024 / 1024) || 0
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const clearCompletedGames = async () => {
    if (!address || !confirm('Clear all completed games?')) return
    
    try {
      const res = await fetch(`${getBackendUrl()}/admin/clear-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-wallet': address.toLowerCase(),
        },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cleared ${data.cleared ?? 0} completed games`)
      } else {
        toast.error(data.error || 'Failed to clear games')
      }
      loadStats()
    } catch (err) {
      toast.error('Failed to clear games')
    }
  }

  const clearAllGames = async () => {
    if (!address || !confirm('This will disconnect ALL active players. Continue?')) return
    
    try {
      const res = await fetch(`${getBackendUrl()}/admin/clear-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-wallet': address.toLowerCase(),
        },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cleared ${data.cleared ?? 0} games`)
      } else {
        toast.error(data.error || 'Failed to clear games')
      }
      loadStats()
    } catch (err) {
      toast.error('Failed to clear games')
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <div className="bg-slate-900/60 backdrop-blur-xl border-2 border-red-500/30 rounded-2xl shadow-2xl p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-3xl font-extrabold text-red-400 mb-3 tracking-tight">Admin Access</h1>
              <p className="text-slate-400 mb-8">Connect your wallet to access the admin panel</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-200 rounded-xl font-semibold transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Game
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-16">
          <div className="max-w-md mx-auto">
            <div className="bg-slate-900/60 backdrop-blur-xl border-2 border-red-500/50 rounded-2xl shadow-2xl p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              
              <h1 className="text-3xl font-extrabold text-red-400 mb-3 tracking-tight">Access Denied</h1>
              <p className="text-slate-400 mb-2">Your wallet is not authorized</p>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 mb-8">
                <p className="text-sm font-mono text-slate-400">
                  {address?.slice(0, 10)}...{address?.slice(-8)}
                </p>
              </div>
              
              <a
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-200 rounded-xl font-semibold transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Game
              </a>

              <div className="mt-8 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                <p className="text-xs text-slate-500">
                  Contact administrator to add your wallet to the admin list
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Admin Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-400">
            Logged in as: <span className="font-mono text-emerald-400 text-xs sm:text-sm">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatCard 
            title="Total Users" 
            value={stats.totalUsers} 
            icon="◍"
            color="emerald"
            loading={loading}
          />
          <StatCard 
            title="Active Games" 
            value={stats.activeGames} 
            icon="♞"
            color="blue"
            loading={loading}
          />
          <StatCard 
            title="Matchmaking Queue" 
            value={stats.queueSize} 
            icon="⏳"
            color="amber"
            loading={loading}
          />
          <StatCard 
            title="Connected Sockets" 
            value={stats.connectedSockets} 
            icon="⇄"
            color="purple"
            loading={loading}
          />
          <StatCard 
            title="Server Uptime" 
            value={`${stats.uptime}h`} 
            icon="⏰"
            color="pink"
            loading={loading}
          />
          <StatCard 
            title="Memory Usage" 
            value={`${stats.memory}MB`} 
            icon="▤"
            color="cyan"
            loading={loading}
          />
        </div>

        {/* Backend Configuration */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <span className="text-base sm:text-2xl">Backend Server Information</span>
          </h2>
          <div className="bg-gradient-to-br from-blue/10 to-blue/5 border border-blue/30 rounded-xl p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-slate-300 mb-2">
              <strong>Current Backend URL:</strong>
            </p>
            <p className="font-mono text-[10px] sm:text-xs text-blue break-all">
              {import.meta.env['VITE_BACKEND_URL'] || 'https://translator-readily-placement-scored.trycloudflare.com'}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-3 sm:mt-4">
              To change the backend URL, update the VITE_BACKEND_URL environment variable and redeploy.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-base sm:text-2xl">Admin Actions</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={clearCompletedGames}
              className="px-4 sm:px-6 py-3 sm:py-4 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 text-amber-400 rounded-xl text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="truncate">Clear Completed Games</span>
            </button>
            <button
              onClick={clearAllGames}
              className="px-4 sm:px-6 py-3 sm:py-4 bg-red-600/20 hover:bg-red-600/30 border border-red-600/40 text-red-400 rounded-xl text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="truncate">Clear ALL Games</span>
            </button>
            <button
              onClick={loadStats}
              disabled={loading}
              className="px-4 sm:px-6 py-3 sm:py-4 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/40 text-emerald-400 disabled:bg-slate-800/40 disabled:border-slate-700 disabled:text-slate-500 rounded-xl text-sm sm:text-base font-semibold transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="truncate">{loading ? 'Loading...' : 'Refresh Stats'}</span>
            </button>
            <a
              href="/profile"
              className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 text-slate-200 rounded-xl text-sm sm:text-base font-semibold transition-all text-center flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">View Profile</span>
            </a>
          </div>
        </div>

        {/* Server Status */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-base sm:text-2xl">Server Health</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-slate-400 mb-2">Status</p>
              <div className="flex items-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400">Online</p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-slate-400 mb-2">Network</p>
              <p className="text-lg sm:text-xl font-bold text-blue-400">Hemi Testnet</p>
              <p className="text-xs sm:text-sm text-blue-400/60 mt-1">Chain ID: 743111</p>
            </div>
          </div>
        </div>

        {/* Blockchain Sync Panel */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8">
          <BlockchainSyncPanel />
        </div>
      </main>
    </div>
  )
}

function StatCard({ title, value, icon, color, loading }: { title: string; value: string | number; icon: string; color: string; loading: boolean }) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/30 text-emerald-400',
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/30 text-blue-400',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-500/30 text-amber-400',
    purple: 'from-orange/10 to-orange/5 border-orange/30 text-orange',
    pink: 'from-teal/10 to-teal/5 border-teal/30 text-teal',
    cyan: 'from-blue/10 to-blue/5 border-blue/30 text-blue',
  }

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-xl p-4 sm:p-6`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <p className="text-[10px] sm:text-sm font-semibold text-slate-400 uppercase tracking-wide truncate">{title}</p>
        <span className="text-2xl sm:text-3xl shrink-0">{icon}</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-slate-600/30 border-t-slate-600 rounded-full animate-spin"></div>
          <p className="text-lg sm:text-2xl font-bold text-slate-600">Loading...</p>
        </div>
      ) : (
        <p className={`text-3xl sm:text-4xl font-extrabold ${(colorMap[color] ?? '').split(' ')[2] ?? ''}`}>{value}</p>
      )}
    </div>
  )
}
