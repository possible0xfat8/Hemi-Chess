import { useState, useEffect } from 'react';
import { getBackendUrl } from '@/lib/config';
import { Eye, Loader2, Swords, Users } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ClickableUsername } from '@/components/ClickableUsername';

interface LiveGame {
  gameId: string;
  whitePlayer: {
    name: string;
    elo: number;
    walletAddress: string;
  };
  blackPlayer: {
    name: string;
    elo: number;
    walletAddress: string;
  };
  spectatorCount: number;
  moveCount: number;
  createdAt: number;
  isRanked: boolean;
  isFriendMatch: boolean;
}

interface LiveGamesProps {
  onSpectate: (gameId: string, whitePlayer: any, blackPlayer: any) => void;
}

export function LiveGames({ onSpectate }: LiveGamesProps) {
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveGames();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchLiveGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchLiveGames = async () => {
    try {
      const url = `${getBackendUrl()}/api/games/live`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setLiveGames(data.games);
        setError(null);
      } else {
        setError('Failed to load live games');
      }
    } catch (err) {
      console.error('[LiveGames] Error fetching:', err);
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const getTimeSince = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  if (isLoading) {
    return (
      <div className="surface p-6">
        <div className="flex items-center gap-2 mb-4">
          <Swords className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Live Games
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
          <Swords className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Live Games
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
          <Swords className="w-4 h-4 text-ink-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Live Games
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-medium text-ink-muted">{liveGames.length}</span>
        </div>
      </div>

      {liveGames.length === 0 ? (
        <div className="text-center py-8">
          <Swords className="w-12 h-12 mx-auto text-ink-faint/50 mb-3" />
          <p className="text-sm text-ink-muted">No live games right now</p>
          <p className="text-xs text-ink-faint mt-1">Start a match to appear here!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {liveGames.map((game) => (
            <div
              key={game.gameId}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {/* Players Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <ClickableUsername 
                    username={game.whitePlayer.name}
                    walletAddress={game.whitePlayer.walletAddress}
                    className="text-xs font-semibold text-ink truncate"
                  />
                  <span className="text-xs text-ink-faint">({game.whitePlayer.elo})</span>
                  <span className="text-xs text-ink-faint">vs</span>
                  <ClickableUsername 
                    username={game.blackPlayer.name}
                    walletAddress={game.blackPlayer.walletAddress}
                    className="text-xs font-semibold text-ink truncate"
                  />
                  <span className="text-xs text-ink-faint">({game.blackPlayer.elo})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  <span>{game.moveCount} moves</span>
                  <span>•</span>
                  <span>{getTimeSince(game.createdAt)}</span>
                  {game.spectatorCount > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{game.spectatorCount}</span>
                      </div>
                    </>
                  )}
                  {game.isFriendMatch && (
                    <>
                      <span>•</span>
                      <span className="text-orange">Friend Match</span>
                    </>
                  )}
                </div>
              </div>

              {/* Watch Button */}
              <button
                onClick={() => onSpectate(game.gameId, game.whitePlayer, game.blackPlayer)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal/20 hover:bg-teal/30 text-teal border border-teal/30 transition-colors text-xs font-semibold"
                title="Watch this game"
              >
                <Eye className="w-3.5 h-3.5" />
                Watch
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
