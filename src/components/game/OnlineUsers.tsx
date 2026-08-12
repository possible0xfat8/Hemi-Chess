import { useState, useEffect } from 'react';
import { getBackendUrl } from '@/lib/config';
import { Users, Swords, Trophy, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ClickableUsername } from '@/components/ClickableUsername';

interface OnlineUser {
  player_id: string;
  username: string;
  wallet_address: string;
  elo_rating: number;
  total_games: number;
  wins: number;
  losses: number;
  avatar_url: string | null;
  online: boolean;
}

interface OnlineUsersProps {
  currentUserId?: string;
  onChallenge: (opponentId: string, opponentName: string) => void;
}

export function OnlineUsers({ currentUserId, onChallenge }: OnlineUsersProps) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOnlineUsers();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchOnlineUsers, 10000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  const fetchOnlineUsers = async () => {
    try {
      const url = new URL(`${getBackendUrl()}/api/users/online`);
      if (currentUserId) {
        url.searchParams.append('excludeUserId', currentUserId);
      }
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.success) {
        setOnlineUsers(data.players);
        setError(null);
      } else {
        setError('Failed to load online users');
      }
    } catch (err) {
      console.error('[OnlineUsers] Error fetching:', err);
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Online Players
          </h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Online Players
          </h2>
        </div>
        <p className="text-sm text-danger-accent text-center py-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="surface p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Online Players
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
          <span className="text-xs font-medium text-ink-muted">{onlineUsers.length}</span>
        </div>
      </div>

      {onlineUsers.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto text-ink-faint/50 mb-3" />
          <p className="text-sm text-ink-muted">No players online right now</p>
          <p className="text-xs text-ink-faint mt-1">Check back soon!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {onlineUsers.map((user) => (
            <div
              key={user.player_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {/* Avatar with online indicator */}
              <Avatar
                src={user.avatar_url}
                alt={user.username}
                size="md"
                fallbackText={user.username}
                className="shrink-0"
                showOnline={true}
                isOnline={true}
              />

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <ClickableUsername 
                  username={user.username}
                  walletAddress={user.wallet_address}
                  className="text-sm font-semibold text-ink truncate block"
                />
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span className="text-xs font-medium text-ink-muted">
                      {user.elo_rating}
                    </span>
                  </div>
                  <span className="text-xs text-ink-faint">•</span>
                  <span className="text-xs text-ink-faint">
                    {user.total_games} games
                  </span>
                </div>
              </div>

              {/* Challenge Button */}
              <button
                onClick={() => onChallenge(user.player_id, user.username)}
                className="shrink-0 p-2 rounded-lg bg-orange/20 hover:bg-orange/30 text-orange border border-orange/30 transition-colors"
                title="Challenge to a match"
              >
                <Swords className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
