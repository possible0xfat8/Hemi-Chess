import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { getSocket, registerPlayerOnline } from '@/lib/socket';
import { getBackendUrl } from '@/lib/config';
import { toast } from 'sonner';

export interface Notification {
  id: number;
  userId?: string | undefined;
  recipient_id?: string | undefined;
  sender_id?: string | undefined;
  sender_username?: string | null | undefined;
  sender_elo?: number | undefined;
  sender_wallet?: string | undefined;
  type: 'friend_request' | 'match_challenge' | 'friend_accepted' | 'challenge' | 'system' | 'game_result';
  title?: string | undefined;
  message?: string | undefined;
  data?: any;
  status: 'unread' | 'read' | 'accepted' | 'declined' | 'expired';
  createdAt?: string | undefined;
  created_at?: string | undefined;
  readAt?: string | undefined;
  read_at?: string | undefined;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  updateStatus: (notificationId: number, status: string) => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    if (!isConnected || !address) return;
    
    setLoading(true);
    try {
      const apiUrl = getBackendUrl();
      
      const response = await fetch(`${apiUrl}/api/notifications/${address.toLowerCase()}`);
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
        
        // Count unread
        const unread = data.filter((n: Notification) => n.status === 'unread').length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address]);

  // Fetch on mount and when wallet changes
  useEffect(() => {
    if (isConnected && address) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isConnected, address, fetchNotifications]);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    if (!isConnected || !address) return;
    
    const socket = getSocket();
    
    // Fetch user data and register player as online with username
    const registerPlayer = async () => {
      try {
        const apiUrl = getBackendUrl();
        const response = await fetch(`${apiUrl}/api/users/${address.toLowerCase()}/stats`);
        
        let username = `${address.slice(0, 6)}...${address.slice(-4)}`;
        
        if (response.ok) {
          const stats = await response.json();
          if (stats.username) {
            username = stats.username;
          }
        }
        
        registerPlayerOnline(address, username);
        console.log('[ONLINE] Registered as:', username);
      } catch (error) {
        console.error('[ONLINE] Error fetching user data:', error);
        // Register with truncated address as fallback
        registerPlayerOnline(address);
      }
    };
    
    // Register player as online when socket connects
    if (socket.connected) {
      registerPlayer();
    }
    
    // Re-register on reconnect
    const handleConnect = () => {
      registerPlayer();
    };
    
    socket.on('connect', handleConnect);
    
    const handleNotificationReceived = (data: { notification: Notification; type: string }) => {
      console.log('[NOTIFICATIONS] Received:', data);
      
      setNotifications(prev => [data.notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Play notification sound (optional)
      if (typeof window !== 'undefined' && 'Audio' in window) {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.3;
          audio.play().catch(() => {
            // Ignore if sound doesn't play
          });
        } catch (e) {
          // Ignore audio errors
        }
      }
    };

    const handleChallengeReceived = (data: { challengeId: string; notification: Notification; challenger_id: string; time_control: number }) => {
      console.log('[CHALLENGE] Received:', data);
      
      // Add challengeId to notification data
      const notificationWithChallenge = {
        ...data.notification,
        data: { ...data.notification.data, challenge_id: data.challengeId }
      };
      
      setNotifications(prev => [notificationWithChallenge, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Play notification sound
      if (typeof window !== 'undefined' && 'Audio' in window) {
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore
        }
      }
    };

    const handleChallengeExpired = (data: { challengeId: string; notificationId?: number; reason?: string }) => {
      console.log('[CHALLENGE] Expired:', data);
      
      // Update notification status if present
      if (data.notificationId) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === data.notificationId ? { ...n, status: 'expired' } : n
          )
        );
      }
    };

    const handleChallengeCancelled = (data: { challengeId: string; notificationId: number; reason?: string }) => {
      console.log('[CHALLENGE] Cancelled:', data);
      
      // Update notification status
      setNotifications(prev =>
        prev.map(n =>
          n.id === data.notificationId ? { ...n, status: 'expired' } : n
        )
      );
    };

    const handleChallengeError = (data: { error: string }) => {
      console.error('[CHALLENGE] Error:', data);
      toast.error(data.error);
    };

    const handleMatchStarting = (data: {
      gameId: string;
      color: 'white' | 'black';
      opponent: { name: string; elo: number; avatar?: string | null };
      fen: string;
      timeLeft: number;
      opponentTimeLeft: number;
      myElo: number;
      myAvatar: string | null;
      opponentElo: number;
      isRanked: boolean;
      isFriendMatch: boolean;
    }) => {
      console.log('[MATCH_STARTING] Global handler - Redirecting to play page', data);
      
      // Check if we're already on the play page
      const isOnPlayPage = typeof window !== 'undefined' && window.location.pathname === '/play';
      
      if (!isOnPlayPage) {
        // Store game data and navigate to play page
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pendingGame', JSON.stringify({
            gameId: data.gameId,
            color: data.color,
            opponent: data.opponent,
            fen: data.fen,
            timeLeft: data.timeLeft,
            opponentTimeLeft: data.opponentTimeLeft,
            myElo: data.myElo,
            myAvatar: data.myAvatar,
            opponentElo: data.opponentElo,
            isRanked: data.isRanked,
            isFriendMatch: data.isFriendMatch
          }));
          
          console.log('[MATCH_STARTING] Stored game data in sessionStorage, redirecting to /play');
          window.location.href = '/play';
        }
      } else {
        // Already on play page - PlayClient will handle it
        console.log('[MATCH_STARTING] Already on play page, PlayClient will handle this');
      }
    };

    socket.on('NOTIFICATION_RECEIVED', handleNotificationReceived);
    socket.on('CHALLENGE_RECEIVED', handleChallengeReceived);
    socket.on('CHALLENGE_EXPIRED', handleChallengeExpired);
    socket.on('CHALLENGE_CANCELLED', handleChallengeCancelled);
    socket.on('CHALLENGE_ERROR', handleChallengeError);
    socket.on('MATCH_STARTING', handleMatchStarting);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('NOTIFICATION_RECEIVED', handleNotificationReceived);
      socket.off('CHALLENGE_RECEIVED', handleChallengeReceived);
      socket.off('CHALLENGE_EXPIRED', handleChallengeExpired);
      socket.off('CHALLENGE_CANCELLED', handleChallengeCancelled);
      socket.off('CHALLENGE_ERROR', handleChallengeError);
      socket.off('MATCH_STARTING', handleMatchStarting);
    };
  }, [isConnected, address]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    if (!address) return;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address.toLowerCase() }),
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, status: 'read', read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking as read:', error);
    }
  }, [address]);

  // Update notification status
  const updateStatus = useCallback(async (notificationId: number, status: string) => {
    if (!address) return;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/notifications/${notificationId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address.toLowerCase(), status }),
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, status: status as any } : n
          )
        );
        
        if (status !== 'unread') {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error updating status:', error);
    }
  }, [address]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: number) => {
    if (!address) return;
    
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: address.toLowerCase() }),
      });
      
      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        if (notification?.status === 'unread') {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error deleting notification:', error);
    }
  }, [address, notifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        updateStatus,
        deleteNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
