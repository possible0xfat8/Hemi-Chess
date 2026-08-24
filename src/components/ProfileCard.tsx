import { Link } from '@tanstack/react-router'
import { Avatar } from './Avatar'
import { HelpCircle } from 'lucide-react'
import { useUserStats, DEFAULT_ELO } from '@/hooks/useUserStats'
import { useState } from 'react'
import { HeloExplanationModal } from './HeloExplanationModal'

interface ProfileCardProps {
  isActive?: boolean | undefined
  isAdmin?: boolean | undefined
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
      <div className="hidden md:flex items-center gap-2">
        <Link
          to="/profile"
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl
            bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90
            border-2 transition-all duration-200 hover:scale-[1.02]
            ${isActive 
              ? 'border-orange-500/60 shadow-lg shadow-orange-500/20' 
              : 'border-slate-700/50 hover:border-slate-600/60 shadow-md shadow-black/20'
            }
          `}
        >
          {/* Avatar with online indicator */}
          <div className="relative shrink-0">
            <Avatar
              src={userStats?.avatar_url}
              alt={username}
              size="md"
              fallbackText={username}
              showOnline={true}
              isOnline={true}
            />
          </div>

          {/* Username and ELO */}
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate max-w-[100px]">
              {username}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Rating:</span>
              <span className="text-xs font-semibold text-yellow-500 whitespace-nowrap">
                {eloRating} $HELO
              </span>
            </div>
          </div>
        </Link>
        
        {/* Help button - separate from card to always be visible */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 p-2 rounded-lg bg-slate-900/80 border border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/60 transition-all group"
          title="What is $HELO?"
          aria-label="Learn about HELO rating system"
        >
          <HelpCircle className="w-4 h-4 text-slate-400 group-hover:text-yellow-500 transition-colors" />
        </button>
      </div>

      {/* Mobile Version - Compact Card with Help Button */}
      <div className="md:hidden flex items-center gap-1.5">
        <Link
          to="/profile"
          className={`
            flex items-center gap-2 px-2.5 py-2 rounded-lg
            bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90
            border transition-all
            ${isActive 
              ? 'border-orange-500/60 shadow-lg shadow-orange-500/20' 
              : 'border-slate-700/50 hover:border-slate-600'
            }
          `}
        >
          {/* Avatar with online indicator */}
          <div className="relative shrink-0">
            <Avatar
              src={userStats?.avatar_url}
              alt={username}
              size="sm"
              fallbackText={username}
              showOnline={true}
              isOnline={true}
            />
          </div>

          {/* Username + ELO on mobile */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-white truncate max-w-[70px]">
              {username}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Rating:</span>
              <span className="text-xs font-semibold text-yellow-500 whitespace-nowrap">
                {eloRating}
              </span>
            </div>
          </div>
        </Link>
        
        {/* Help button - separate and always visible on mobile */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="shrink-0 p-2 rounded-lg bg-slate-900/80 border border-slate-700/50 active:bg-slate-800/80 transition-all"
          title="What is $HELO?"
          aria-label="Learn about HELO rating system"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* HELO Explanation Modal */}
      <HeloExplanationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
