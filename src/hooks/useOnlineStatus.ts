import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { getSocket } from '@/lib/socket';
import { getBackendUrl } from '@/lib/config';

interface UserOnlineStatus {
  walletAddress: string;
  is_online: boolean;
  last_seen?: string | undefined;
  online_status?: ('online' | 'offline' | 'appear_offline') | undefined;
}

interface OnlineStatusMap {
  [walletAddress: string]: UserOnlineStatus;
}

/**
 * Hook to track real-time online status of users
 * Subscribes to WebSocket events for instant updates
 */
export function useOnlineStatus(walletAddresses?: string[] | undefined) {
  const [onlineStatuses, setOnlineStatuses] = useState<OnlineStatusMap>({});
  const [loading, setLoading] = useState(false);

  // Fetch initial status for specific users
  const fetchStatuses = useCallback(async (addresses: string[]) => {
    if (addresses.length === 0) return;
    
    setLoading(true);
    try {
      const apiUrl = getBackendUrl();
      const results = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const response = await fetch(`${apiUrl}/api/user/${addr.toLowerCase()}/status`);
            if (response.ok) {
              const data = await response.json();
              return { walletAddress: addr.toLowerCase(), is_online: Boolean(data.is_online), ...data };
            }
          } catch (error) {
            console.error(`Failed to fetch status for ${addr}:`, error);
          }
          return null;
        })
      );
      
      const statusMap: OnlineStatusMap = {};
      results.forEach(status => {
        if (status) {
          statusMap[status.walletAddress] = {
            walletAddress: status.walletAddress,
            is_online: Boolean(status.is_online),
            ...(status.last_seen ? { last_seen: status.last_seen } : {}),
            ...(status.online_status ? { online_status: status.online_status } : {}),
          };
        }
      });
      
      setOnlineStatuses(statusMap);
    } catch (error) {
      console.error('[ONLINE_STATUS] Error fetching statuses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch initial statuses
  useEffect(() => {
    if (walletAddresses && walletAddresses.length > 0) {
      fetchStatuses(walletAddresses);
    }
  }, [walletAddresses?.join(','), fetchStatuses]);

  // Subscribe to real-time status updates via WebSocket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleStatusChange = (data: { walletAddress: string; is_online: boolean; timestamp: number }) => {
      const addr = data.walletAddress.toLowerCase();
      setOnlineStatuses(prev => {
        const existing = prev[addr];
        const updated: UserOnlineStatus = {
          walletAddress: addr,
          is_online: data.is_online,
          ...(data.is_online ? {} : { last_seen: new Date(data.timestamp).toISOString() }),
          ...(existing?.online_status ? { online_status: existing.online_status } : {}),
        };
        return {
          ...prev,
          [addr]: updated,
        };
      });
    };

    const handleStatusPreferenceChange = (data: { walletAddress: string; statusPreference: string; timestamp: number }) => {
      const addr = data.walletAddress.toLowerCase();
      setOnlineStatuses(prev => {
        const existing = prev[addr];
        const updated: UserOnlineStatus = {
          walletAddress: addr,
          is_online: existing?.is_online ?? false,
          ...(existing?.last_seen ? { last_seen: existing.last_seen } : {}),
          online_status: data.statusPreference as 'online' | 'offline' | 'appear_offline',
        };
        return {
          ...prev,
          [addr]: updated,
        };
      });
    };

    socket.on('user_status_changed', handleStatusChange);
    socket.on('user_status_preference_changed', handleStatusPreferenceChange);

    return () => {
      socket.off('user_status_changed', handleStatusChange);
      socket.off('user_status_preference_changed', handleStatusPreferenceChange);
    };
  }, []);

  // Helper to check if a specific user is online
  const isUserOnline = useCallback((walletAddress: string): boolean => {
    const status = onlineStatuses[walletAddress.toLowerCase()];
    if (!status) return false;
    
    // Respect appear_offline preference
    if (status.online_status === 'appear_offline') return false;
    
    return status.is_online;
  }, [onlineStatuses]);

  // Helper to get last seen for a user
  const getLastSeen = useCallback((walletAddress: string): string | undefined => {
    return onlineStatuses[walletAddress.toLowerCase()]?.last_seen;
  }, [onlineStatuses]);

  return {
    onlineStatuses,
    isUserOnline,
    getLastSeen,
    loading,
    refetch: () => walletAddresses && fetchStatuses(walletAddresses),
  };
}

/**
 * Hook to manage current user's online status preference
 */
export function useMyOnlineStatus() {
  const { address, isConnected } = useAccount();
  const [statusPreference, setStatusPreferenceState] = useState<'online' | 'offline' | 'appear_offline'>('online');
  const [updating, setUpdating] = useState(false);

  // Set status preference
  const setStatusPreference = useCallback(async (preference: 'online' | 'offline' | 'appear_offline') => {
    if (!isConnected || !address) return;
    
    setUpdating(true);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/user/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address.toLowerCase(),
          statusPreference: preference,
        }),
      });
      
      if (response.ok) {
        setStatusPreferenceState(preference);
      }
    } catch (error) {
      console.error('[ONLINE_STATUS] Failed to update status preference:', error);
    } finally {
      setUpdating(false);
    }
  }, [isConnected, address]);

  return {
    statusPreference,
    setStatusPreference,
    updating,
  };
}

/**
 * Hook to get count of online users
 */
export function useOnlineCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchOnlineCount = useCallback(async () => {
    setLoading(true);
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/users/online`);
      
      if (response.ok) {
        const data = await response.json();
        setCount(data.count || 0);
      }
    } catch (error) {
      console.error('[ONLINE_STATUS] Failed to fetch online count:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnlineCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(fetchOnlineCount, 30000);
    return () => clearInterval(interval);
  }, [fetchOnlineCount]);

  // Listen to status changes to update count
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleStatusChange = () => {
      // Debounce count updates
      setTimeout(fetchOnlineCount, 1000);
    };

    socket.on('user_status_changed', handleStatusChange);

    return () => {
      socket.off('user_status_changed', handleStatusChange);
    };
  }, [fetchOnlineCount]);

  return { count, loading, refetch: fetchOnlineCount };
}
