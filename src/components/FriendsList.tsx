import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getBackendUrl } from '@/lib/config';
import { Users, Swords, UserMinus, Search, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Friend {
  friendship_id: number;
  friend_id: string;
  username: string;
  elo_rating: number;
  wallet_address: string;
  total_games: number;
  wins: number;
  last_active: string;
  friendship_since: string;
  status: string;
}

interface SearchResult {
  player_id: string;
  username: string;
  elo_rating: number;
  wallet_address: string;
  total_games: number;
  wins: number;
}

export function FriendsList() {
  const { address, isConnected } = useAccount();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'search'>('friends');
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Fetch friends list
  const fetchFriends = async () => {
    if (!isConnected || !address) return;
    
    setLoading(true);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/friends/${address.toLowerCase()}`);
      
      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('[FRIENDS] Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search for players
  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/players/search?q=${encodeURIComponent(query)}`);
      
      if (response.ok) {
        const data = await response.json();
        // Filter out self
        const filtered = data.filter((p: SearchResult) => 
          p.player_id.toLowerCase() !== address?.toLowerCase()
        );
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('[SEARCH] Error searching players:', error);
    } finally {
      setSearching(false);
    }
  };

  // Send friend request
  const sendFriendRequest = async (friendId: string) => {
    if (!address) return;
    
    setSendingRequest(friendId);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: address.toLowerCase(),
          friendId: friendId.toLowerCase(),
        }),
      });
      
      if (response.ok) {
        alert('Friend request sent!');
        // Refresh search results
        searchPlayers(searchQuery);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('[FRIENDS] Error sending request:', error);
      alert('Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  // Remove friend
  const removeFriend = async (friendId: string) => {
    if (!address || !confirm('Remove this friend?')) return;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/friends/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: address.toLowerCase(),
          friendId: friendId.toLowerCase(),
        }),
      });
      
      if (response.ok) {
        fetchFriends();
      }
    } catch (error) {
      console.error('[FRIENDS] Error removing friend:', error);
    }
  };

  // Send challenge
  const sendChallenge = async (friendId: string) => {
    if (!address) return;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/challenge/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerId: address.toLowerCase(),
          opponentId: friendId.toLowerCase(),
          timeControl: 600000, // 10 minutes default
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Challenge sent! Waiting for ${friendId.slice(0, 8)}... to accept.`);
        console.log('[CHALLENGE] Sent:', result);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send challenge');
      }
    } catch (error) {
      console.error('[CHALLENGE] Error sending challenge:', error);
      alert('Failed to send challenge');
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchFriends();
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => searchPlayers(searchQuery), 300);
      return () => clearTimeout(timer);
    }
    setSearchResults([]);
    return undefined;
  }, [searchQuery]);

  if (!isConnected || !address) {
    return (
      <div className="surface p-8 text-center">
        <Users className="w-16 h-16 mx-auto mb-4 text-ink-faint" />
        <h3 className="text-xl font-bold mb-2">Friends</h3>
        <p className="text-ink-muted">Connect your wallet to see your friends</p>
      </div>
    );
  }

  return (
    <div className="surface overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-line">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-wide text-ink-muted">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange shrink-0" />
            <span>Friends</span>
          </h2>
          <button
            onClick={fetchFriends}
            className="px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg text-sm font-medium transition-all"
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-line">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'friends'
                ? 'text-orange border-b-2 border-orange'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-orange border-b-2 border-orange'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Add Friends
          </button>
        </div>
      </div>

      {/* Friends Tab */}
      {activeTab === 'friends' && (
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-ink-faint" />
              <p className="text-ink-muted mb-4">No friends yet</p>
              <button
                onClick={() => setActiveTab('search')}
                className="px-4 py-2 bg-orange hover:bg-orange/90 text-canvas rounded-lg font-semibold transition-colors"
              >
                Find Friends
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div
                  key={friend.friendship_id}
                  className="flex items-center gap-3 p-3 bg-[var(--surface-strong)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange to-amber-600 flex items-center justify-center text-canvas font-bold shrink-0">
                    {friend.username.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{friend.username}</div>
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                      <span>{friend.elo_rating} ELO</span>
                      <span>•</span>
                      <span>{friend.total_games} games</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => sendChallenge(friend.friend_id)}
                      className="p-2 bg-orange hover:bg-orange/90 text-canvas rounded-lg transition-colors"
                      title="Challenge to match"
                    >
                      <Swords className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFriend(friend.friend_id)}
                      className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-line text-ink-muted rounded-lg transition-colors"
                      title="Remove friend"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="p-4 sm:p-6">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by username or wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-line focus:border-orange focus:ring-1 focus:ring-orange rounded-lg text-ink placeholder-ink-faint transition-all outline-none"
            />
          </div>

          {/* Search Results */}
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange" />
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-12">
              <Search className="w-16 h-16 mx-auto mb-4 text-ink-faint" />
              <p className="text-ink-muted">Enter at least 2 characters to search</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ink-muted">No players found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((player) => {
                const isFriend = friends.some(f => f.friend_id === player.player_id);
                
                return (
                  <div
                    key={player.player_id}
                    className="flex items-center gap-3 p-3 bg-[var(--surface-strong)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal to-blue-600 flex items-center justify-center text-canvas font-bold shrink-0">
                      {player.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink truncate">{player.username}</div>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span>{player.elo_rating} ELO</span>
                        <span>•</span>
                        <span>{player.total_games} games</span>
                      </div>
                    </div>

                    {/* Action */}
                    {isFriend ? (
                      <span className="px-3 py-1.5 bg-teal/20 text-teal text-sm font-medium rounded-lg">
                        Friends
                      </span>
                    ) : (
                      <button
                        onClick={() => sendFriendRequest(player.player_id)}
                        disabled={sendingRequest === player.player_id}
                        className="px-3 py-1.5 bg-orange hover:bg-orange/90 disabled:bg-line text-canvas disabled:text-ink-faint text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                      >
                        {sendingRequest === player.player_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Add Friend'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
