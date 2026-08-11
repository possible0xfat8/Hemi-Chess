import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { getBackendUrl } from '@/lib/config'

/** Every new player starts here — must match backend DEFAULT_ELO */
export const DEFAULT_ELO = 1200

export interface UserStats {
  elo_rating: number
  wins: number
  losses: number
  draws: number
  total_games: number
  win_rate: number
}


interface MatchHistory {
  game_id: string
  outcome: 'W' | 'L' | 'D'
  my_color: 'white' | 'black'
  elo_before: number
  elo_after: number
  elo_change: number
  completed_at: string
}

/**
 * Hook to fetch user stats from database
 * Returns ELO, W/L, win rate from PostgreSQL
 * NOTE: ELO is now read from DATABASE (not smart contract)
 */
export function useUserStats() {
  const { address, isConnected } = useAccount()

  return useQuery<UserStats>({
    queryKey: ['userStats', address],
    queryFn: async () => {
      const fallback: UserStats = {
        elo_rating: DEFAULT_ELO,
        wins: 0,
        losses: 0,
        draws: 0,
        total_games: 0,
        win_rate: 0,
      }

      if (!address) return fallback

      const response = await fetch(`${getBackendUrl()}/api/users/${address}/stats`)
      if (!response.ok) {
        throw new Error('Failed to fetch user stats')
      }
      const data = await response.json()

      // Database is the source of truth; normalise so the UI never shows 0 ELO
      return {
        ...fallback,
        ...data,
        elo_rating:
          data?.elo_rating === null || data?.elo_rating === undefined
            ? DEFAULT_ELO
            : Math.round(Number(data.elo_rating)),
      }
    },
    enabled: isConnected && !!address,
    staleTime: 5000, // Cache for 5 seconds (shorter for faster updates)
    refetchOnWindowFocus: true,

  })
}

/**
 * Hook to fetch user match history
 * Returns last N matches for "Your form" display
 */
export function useMatchHistory(limit = 4) {
  const { address, isConnected } = useAccount()

  return useQuery<MatchHistory[]>({
    queryKey: ['matchHistory', address, limit],
    queryFn: async () => {
      if (!address) {
        return []
      }

      const response = await fetch(
        `${getBackendUrl()}/api/users/${address}/history?limit=${limit}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch match history')
      }
      return response.json()
    },
    enabled: isConnected && !!address,
    staleTime: 10000, // Cache for 10 seconds
    refetchOnWindowFocus: true,
  })
}
