import { useUserStats, DEFAULT_ELO } from '@/hooks/useUserStats'
import { Trophy, Loader2 } from 'lucide-react'

/**
 * Rating badge - Shows ELO from database (source of truth)
 * Blockchain sync happens in background via backend oracle
 */
export function EloBalance() {
  const { data: userStats, isLoading: isLoadingStats } = useUserStats()

  if (!userStats && !isLoadingStats) {
    return null
  }

  const eloRating = userStats?.elo_rating ?? DEFAULT_ELO

  return (
    <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2">
      <Trophy className="w-4 h-4 text-yellow-500" />

      {isLoadingStats ? (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          <span className="text-xs text-slate-400">Loading...</span>
        </div>
      ) : (
        <span className="text-xs font-semibold text-yellow-500">{eloRating} ELO</span>
      )}
    </div>
  )
}
