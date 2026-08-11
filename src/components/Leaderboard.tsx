import { useState, useEffect } from 'react';
import { getBackendUrl } from '@/lib/config';
import { Trophy, TrendingUp, Medal } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

interface LeaderboardEntry {
  rank: number;
  player_id: string;
  username: string;
  wallet_address: string;
  elo_rating: number;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;
}

export function Leaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${getBackendUrl()}/api/leaderboard?limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      
      const data = await response.json();
      setLeaderboard(Array.isArray(data) ? data : (data?.leaderboard ?? []));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileClick = (walletAddress: string) => {
    navigate({ to: '/user/$address', params: { address: walletAddress } });
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-canvas font-bold">1</div>;
    }
    if (rank === 2) {
      return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--text-muted)] to-[var(--text-faint)] flex items-center justify-center text-canvas font-bold">2</div>;
    }
    if (rank === 3) {
      return <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-canvas font-bold">3</div>;
    }
    return <div className="w-8 h-8 rounded-full bg-[var(--surface-strong)] flex items-center justify-center text-ink-muted font-semibold">{rank}</div>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-line border-t-orange rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="surface p-6 text-center">
        <div className="text-danger-accent mb-4">Failed to load leaderboard</div>
        <button
          onClick={fetchLeaderboard}
          className="px-4 py-2 bg-orange hover:bg-orange/90 text-canvas rounded-lg font-semibold transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="surface p-12 text-center">
        <Trophy className="w-16 h-16 mx-auto mb-4 text-ink-faint" />
        <h3 className="text-xl font-bold mb-2">No Rankings Yet</h3>
        <p className="text-ink-muted">Play a ranked game to enter the standings.</p>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold uppercase tracking-wide text-ink-muted">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
              <span className="truncate">Standings</span>
            </h2>
            
          </div>
          <button
            onClick={fetchLeaderboard}
            className="shrink-0 px-3 sm:px-4 py-2 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg text-sm font-medium transition-all"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--surface-strong)] border-b border-line">
            <tr>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Rank</th>
              <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Player</th>
              <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Rating</th>
              <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Games</th>
              <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">W/L/D</th>
              <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-ink-muted uppercase tracking-wider">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {leaderboard.map((entry) => (
              <tr 
                key={entry.player_id} 
                onClick={() => handleProfileClick(entry.wallet_address)}
                className="hover:bg-[var(--surface-strong)] transition-colors cursor-pointer"
              >
                <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                  {getRankBadge(entry.rank)}
                </td>
                <td className="px-4 lg:px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--surface-strong)] to-[var(--surface-strong)] ring-1 ring-line text-orange flex items-center justify-center text-canvas font-bold shrink-0">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{entry.username}</div>
                      <div className="text-xs text-ink-faint font-mono truncate">
                        {entry.wallet_address
                          ? `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}`
                          : 'No wallet linked'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 lg:px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-lg font-bold text-amber-400">{entry.elo_rating}</span>
                    {entry.rank <= 10 && <TrendingUp className="w-4 h-4 text-teal" />}
                  </div>
                </td>
                <td className="px-4 lg:px-6 py-4 text-center">
                  <span className="text-ink font-medium">{entry.total_games}</span>
                </td>
                <td className="px-4 lg:px-6 py-4">
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <span className="text-teal font-semibold">{entry.wins}</span>
                    <span className="text-ink-faint">/</span>
                    <span className="text-danger-accent font-semibold">{entry.losses}</span>
                    <span className="text-ink-faint">/</span>
                    <span className="text-ink-muted font-semibold">{entry.draws}</span>
                  </div>
                </td>
                <td className="px-4 lg:px-6 py-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                    entry.win_rate >= 60 ? 'bg-teal/20 text-teal' :
                    entry.win_rate >= 40 ? 'bg-amber-400/20 text-amber-400' :
                    'bg-danger-accent/20 text-danger-accent'
                  }`}>
                    {Number(entry.win_rate ?? 0).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-line">
        {leaderboard.map((entry) => (
          <div 
            key={entry.player_id} 
            onClick={() => handleProfileClick(entry.wallet_address)}
            className="p-3 hover:bg-[var(--surface-strong)] transition-colors cursor-pointer"
          >
            {/* Rank and Player Info */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="shrink-0">{getRankBadge(entry.rank)}</div>
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--surface-strong)] ring-1 ring-line text-orange flex items-center justify-center font-bold">
                {entry.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink truncate leading-tight">{entry.username}</div>
                <div className="text-[11px] text-ink-faint font-mono truncate">
                  {entry.wallet_address
                    ? `${entry.wallet_address.slice(0, 6)}...${entry.wallet_address.slice(-4)}`
                    : 'No wallet linked'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">Rating</div>
                <div className="text-lg font-bold text-amber-400 leading-tight">{entry.elo_rating}</div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--surface-strong)] p-2.5 text-center">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">Games</div>
                <div className="text-sm font-bold text-ink">{entry.total_games}</div>
              </div>
              <div className="min-w-0 border-x border-line">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">W/L/D</div>
                <div className="text-sm font-bold">
                  <span className="text-teal">{entry.wins}</span>
                  <span className="text-ink-faint">/</span>
                  <span className="text-danger-accent">{entry.losses}</span>
                  <span className="text-ink-faint">/</span>
                  <span className="text-ink-muted">{entry.draws}</span>
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-ink-faint font-semibold">Win Rate</div>
                <div className={`text-sm font-bold ${
                  entry.win_rate >= 60 ? 'text-teal' :
                  entry.win_rate >= 40 ? 'text-amber-400' :
                  'text-danger-accent'
                }`}>
                  {Number(entry.win_rate ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-line bg-[var(--surface-strong)] text-center text-xs sm:text-sm text-ink-muted">
        Showing top {leaderboard.length} players
      </div>
    </div>
  );
}
