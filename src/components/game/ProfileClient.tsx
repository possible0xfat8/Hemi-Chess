import { getBackendUrl } from '@/lib/config'
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Avatar } from '@/components/Avatar';
import { AvatarUpload } from '@/components/AvatarUpload';
import { DEFAULT_ELO } from '@/hooks/useUserStats';
import { TrendingUp, TrendingDown, Copy, Check } from 'lucide-react';

export function ProfileClient() {
  const { address, isConnected } = useAccount();
  const [displayName, setDisplayName] = useState('');
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Load display name from database
  useEffect(() => {
    if (isConnected && address) {
      // Fetch stats from backend (includes username)
      fetchStats();
    }
  }, [isConnected, address]);

  const fetchStats = async () => {
    if (!address) return;
    
    setIsLoadingStats(true);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/player/${address.toLowerCase()}/stats`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        
        // Set display name from database
        if (data.username) {
          setDisplayName(data.username);
          // Only set newName if it's not the default wallet format
          const isDefaultName = data.username.includes('...') && data.username.length < 20;
          setNewName(isDefaultName ? '' : data.username);
        } else {
          // Fallback to wallet address
          const defaultName = `${address.slice(0, 6)}...${address.slice(-4)}`;
          setDisplayName(defaultName);
          setNewName('');
        }
        
        // Set avatar URL if exists
        if (data.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      // Fallback to wallet address on error
      const defaultName = `${address.slice(0, 6)}...${address.slice(-4)}`;
      setDisplayName(defaultName);
      setNewName('');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSaveName = async () => {
    if (!isConnected || !address) {
      setMessageOk(false); 
      setMessage('Please connect your wallet first');
      return;
    }

    const trimmedName = newName.trim();
    
    if (trimmedName && trimmedName.length < 3) {
      setMessageOk(false); 
      setMessage('Display name must be at least 3 characters');
      return;
    }

    if (trimmedName && trimmedName.length > 20) {
      setMessageOk(false); 
      setMessage('Display name must be 20 characters or less');
      return;
    }

    setIsSaving(true);
    
    try {
      const apiUrl = getBackendUrl();
      const usernameToSave = trimmedName || `${address.slice(0, 6)}...${address.slice(-4)}`;
      
      const response = await fetch(`${apiUrl}/api/player/${address.toLowerCase()}/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameToSave }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.player) {
          setDisplayName(result.player.username);
          setStats(result.player);
          setMessageOk(true);
          setMessage(trimmedName ? 'Display name saved!' : 'Display name cleared — using wallet address');
        } else {
          setMessageOk(false);
          setMessage(result.error || 'Failed to save display name');
        }
      } else {
        const error = await response.json();
        setMessageOk(false);
        setMessage(error.error || 'Failed to save display name');
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error saving username:', error);
      setMessageOk(false);
      setMessage('Failed to save display name');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearName = async () => {
    if (!address) return;
    
    setNewName('');
    const defaultName = `${address.slice(0, 6)}...${address.slice(-4)}`;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/player/${address.toLowerCase()}/username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: defaultName }),
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.player) {
          setDisplayName(result.player.username);
          setStats(result.player);
          setMessageOk(true);
          setMessage('Display name cleared');
        }
      }
    } catch (error) {
      console.error('Error clearing username:', error);
    }
    
    setTimeout(() => setMessage(''), 3000);
  };

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-16 flex-1">
          <div className="surface p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-[var(--surface-strong)] rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold mb-3">Profile</h1>
            <p className="mb-8 text-ink-muted">Connect a wallet to view your rating and match record.</p>
            <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-xl font-semibold transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Game
            </a>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const winRate = stats && stats.total_games > 0 ? parseFloat(stats.win_rate).toFixed(1) : '0';
  const currentElo = stats?.elo_rating ?? DEFAULT_ELO;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1">
        {/* Profile Header */}
        <div className="surface p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Avatar with online indicator */}
            <div className="relative flex-shrink-0 mx-auto sm:mx-0">
              <Avatar
                src={avatarUrl}
                alt={displayName}
                size="xl"
                fallbackText={displayName}
                showOnline={true}
                isOnline={true}
              />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-teal rounded-full border-4 border-[var(--canvas)] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-canvas" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Name & Address */}
            <div className="flex-1 min-w-0 text-center sm:text-left w-full sm:w-auto">
              <h1 className="mb-2 truncate text-2xl sm:text-3xl font-extrabold tracking-tight">{displayName}</h1>
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line rounded-lg text-sm font-medium transition-colors"
                >
                  <span className="font-mono text-ink-muted">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  {copied ? <Check className="w-4 h-4 text-teal" /> : <Copy className="w-4 h-4 text-ink-faint" />}
                </button>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[var(--surface-strong)] border border-line rounded text-xs font-semibold text-ink-muted">
                    Hemi Testnet
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                    <div className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-orange opacity-75 animate-ping"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange"></span>
                    </div>
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full sm:w-auto mt-3 sm:mt-0">
              <a href="/" className="block sm:inline-block text-center px-4 py-2 bg-orange hover:bg-orange/90 text-canvas rounded-lg font-semibold transition-colors">
                Play Chess
              </a>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Overview */}
            <div className="surface p-4 sm:p-6">
              <h2 className="mb-4 sm:mb-6 text-sm font-semibold uppercase tracking-wide text-ink-faint">Performance</h2>
              
              {isLoadingStats ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-line border-t-orange rounded-full animate-spin"></div>
                </div>
              ) : stats && !stats.error ? (
                <>
                  {/* Primary Stats - Responsive Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="surface-inset p-3 sm:p-4 text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-amber-400 mb-1">{currentElo}</div>
                      <div className="text-[10px] sm:text-xs text-ink-faint uppercase">Rating</div>
                    </div>
                    <div className="surface-inset p-3 sm:p-4 text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-ink mb-1">{stats.total_games || 0}</div>
                      <div className="text-[10px] sm:text-xs text-ink-faint uppercase">Games</div>
                    </div>
                    <div className="surface-inset p-3 sm:p-4 text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-teal mb-1">{winRate}%</div>
                      <div className="text-[10px] sm:text-xs text-ink-faint uppercase">Win Rate</div>
                    </div>
                    <div className="surface-inset p-3 sm:p-4 text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-orange mb-1">{stats.wins || 0}</div>
                      <div className="text-[10px] sm:text-xs text-ink-faint uppercase">Wins</div>
                    </div>
                  </div>

                  {/* W/L/D Breakdown */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between p-2.5 sm:p-3 bg-teal/10 border border-teal/30 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-teal mb-1 sm:mb-0">Wins</span>
                      <span className="text-base sm:text-lg font-bold text-teal">{stats.wins || 0}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between p-2.5 sm:p-3 bg-[var(--surface-strong)] border border-line rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-ink-muted mb-1 sm:mb-0">Draws</span>
                      <span className="text-base sm:text-lg font-bold text-ink">{stats.draws || 0}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between p-2.5 sm:p-3 bg-danger-accent/10 border border-danger-accent/30 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium text-danger-accent mb-1 sm:mb-0">Losses</span>
                      <span className="text-base sm:text-lg font-bold text-danger-accent">{stats.losses || 0}</span>
                    </div>
                  </div>

                </>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[var(--surface-strong)] rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-ink-muted mb-2">No stats yet</p>
                  <p className="text-sm text-ink-faint">Play a ranked game to build your record.</p>
                </div>
              )}
            </div>

            {/* Edit Profile */}
            <div className="surface p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Profile Picture</h2>
              
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                walletAddress={address}
                onUploadSuccess={(url) => {
                  setAvatarUrl(url);
                  // Refresh stats to get updated avatar URL
                  fetchStats();
                }}
              />
            </div>

            {/* Edit Display Name */}
            <div className="surface p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Display name</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-ink-muted mb-2 block">Display Name</label>
                  <input
                    type="text"
                    placeholder="Enter a custom name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-line focus:border-orange focus:ring-1 focus:ring-orange rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-ink placeholder-ink-faint transition-all outline-none text-sm sm:text-base"
                    maxLength={20}
                  />
                  <p className="mt-1.5 text-xs text-ink-faint">3–20 characters. Leave blank to use your wallet address.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2.5 bg-orange hover:bg-orange/90 disabled:bg-line text-canvas disabled:text-ink-faint font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleClearName}
                    className="px-4 py-2.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg font-medium transition-all text-sm sm:text-base"
                  >
                    Clear
                  </button>
                </div>

                {message && (
                  <div className={`p-3 rounded-lg text-sm font-medium text-center ${
                    messageOk 
                      ? 'bg-teal/10 border border-teal/30 text-teal' 
                      : 'bg-danger-accent/10 border border-danger-accent/30 text-danger-accent'
                  }`}>
                    {message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Quick Links */}
            <div className="surface p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Shortcuts</h3>
              <div className="space-y-2">
                <a href="/" className="flex items-center justify-between w-full px-4 py-2.5 bg-orange hover:bg-orange/90 text-canvas rounded-lg font-semibold transition-colors text-sm sm:text-base">
                  <span>Find Match</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </a>
                <a href="/leaderboard" className="flex items-center justify-between w-full px-4 py-2.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg font-medium transition-all text-sm sm:text-base">
                  <span>Leaderboard</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Network Badge */}
            <div className="surface p-4 sm:p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">Network</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Chain</span>
                  <span className="font-semibold">Hemi Testnet</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Chain ID</span>
                  <span className="font-mono font-semibold">743111</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange"></div>
                    <span className="font-semibold text-orange">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
