import { Link } from '@tanstack/react-router'
import { Avatar } from './Avatar'
import { HelpCircle } from 'lucide-react'
import { useUserStats, DEFAULT_ELO } from '@/hooks/useUserStats'
import { useState } from 'react'
import { HeloExplanationModal } from './HeloExplanationModal'

interface ProfileCardProps {
  isActive?: boolean
  isAdmin?: boolean
}

/**
 * Prestigious profile card combining avatar, username, and ELO rating
 * Desktop: Full card with all info
 * Mobile: Compact version with avatar, username, and ELO
 */
export function ProfileCard({ isActive }: ProfileCardProps) {
  const { data: userStats } = useUserStats()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const eloRating = userStats?.elo_rating ?? DEFAULT_ELO
  const username = userStats?.username || 'Player'

  return (
    <>
      {/* Desktop Version - Full Prestigious Card */}
      <Link
        to="/profile"
        className={`
          hidden md:flex items-center gap-3 px-3 py-2.5 rounded-xl
          bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90
          border-2 transition-all duration-200 hover:scale-[1.02]
          ${isActive 
            ? 'border-orange-500/60 shadow-lg shadow-orange-500/20' 
            : 'border-slate-700/50 hover:border-slate-600/60 shadow-md shadow-black/20'
          }
        `}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar
            src={userStats?.avatar_url}
            alt={username}
            size="md"
            fallbackText={username}
          />
        </div>

        {/* Username and ELO */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-white truncate max-w-[120px]">
            {username}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400">Rating:</span>
            <span className="text-xs font-semibold text-yellow-500">
              {eloRating} $HELO
            </span>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsModalOpen(true)
              }}
              className="p-0.5 rounded-full hover:bg-slate-700/50 transition-colors group"
              title="What is $HELO?"
              aria-label="Learn about HELO rating system"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-yellow-500 transition-colors" />
            </button>
          </div>
        </div>
      </Link>

      {/* Mobile Version - Compact Card with Username */}
      <Link
        to="/profile"
        className={`
          md:hidden flex items-center gap-2 px-2.5 py-2 rounded-lg
          bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90
          border transition-all
          ${isActive 
            ? 'border-orange-500/60 shadow-lg shadow-orange-500/20' 
            : 'border-slate-700/50 hover:border-slate-600'
          }
        `}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar
            src={userStats?.avatar_url}
            alt={username}
            size="sm"
            fallbackText={username}
          />
        </div>

        {/* Username + ELO on mobile */}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-white truncate max-w-[80px]">
            {username}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-slate-400">Rating:</span>
            <span className="text-xs font-semibold text-yellow-500">
              {eloRating} $HELO
            </span>
          </div>
        </div>
      </Link>

      {/* HELO Explanation Modal */}
      <HeloExplanationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
