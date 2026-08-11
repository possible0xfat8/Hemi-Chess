import { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, User, Swords, UserPlus } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useAccount } from 'wagmi';
import { getBackendUrl } from '@/lib/config';
import { getSocket } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, updateStatus, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { address } = useAccount();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleAcceptFriendRequest = async (notificationId: number, friendshipId: number) => {
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendshipId,
          userId: address?.toLowerCase(),
        }),
      });

      if (response.ok) {
        await updateStatus(notificationId, 'accepted');
      }
    } catch (error) {
      console.error('[FRIENDS] Error accepting request:', error);
    }
  };

  const handleDeclineFriendRequest = async (notificationId: number, friendshipId: number) => {
    try {
      const apiUrl = getBackendUrl();
      const response = await fetch(`${apiUrl}/api/friends/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friendshipId,
          userId: address?.toLowerCase(),
        }),
      });

      if (response.ok) {
        await updateStatus(notificationId, 'declined');
      }
    } catch (error) {
      console.error('[FRIENDS] Error declining request:', error);
    }
  };

  const handleAcceptChallenge = async (notificationId: number, challengerId: string, challengeId?: string) => {
    try {
      // Emit socket event to accept challenge
      const socket = getSocket();
      
      if (challengeId) {
        socket.emit('accept_challenge', { 
          challengeId, 
          notificationId 
        });
        
        // Update notification status optimistically
        await updateStatus(notificationId, 'accepted');
      } else {
        // Fallback for old notifications without challengeId
        await updateStatus(notificationId, 'accepted');
        window.location.href = '/play';
      }
    } catch (error) {
      console.error('[CHALLENGE] Error accepting challenge:', error);
    }
  };

  const handleDeclineChallenge = async (notificationId: number) => {
    await updateStatus(notificationId, 'declined');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'match_challenge':
        return <Swords className="w-4 h-4 text-orange" />;
      case 'friend_accepted':
        return <User className="w-4 h-4 text-teal" />;
      default:
        return <Bell className="w-4 h-4 text-ink-muted" />;
    }
  };

  const getNotificationMessage = (notification: typeof notifications[0]) => {
    switch (notification.type) {
      case 'friend_request':
        return `${notification.sender_username || 'Someone'} sent you a friend request`;
      case 'match_challenge':
        return `${notification.sender_username || 'Someone'} challenged you to a match`;
      case 'friend_accepted':
        return `${notification.sender_username || 'Someone'} accepted your friend request`;
      default:
        return 'New notification';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line transition-colors"
      >
        <Bell className="w-5 h-5 text-ink" />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-canvas bg-orange rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-[var(--surface)] border border-line rounded-lg shadow-lg z-50 max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <h3 className="font-semibold text-ink">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-ink-muted">{unreadCount} unread</span>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 mx-auto mb-3 text-ink-faint" />
                <p className="text-sm text-ink-muted">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-line hover:bg-[var(--surface-strong)] transition-colors ${
                    notification.status === 'unread' ? 'bg-orange/5' : ''
                  }`}
                  onClick={() => {
                    if (notification.status === 'unread') {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink font-medium mb-1">
                        {getNotificationMessage(notification)}
                      </p>
                      
                      {notification.sender_elo && (
                        <p className="text-xs text-ink-muted mb-2">
                          {notification.sender_elo} ELO
                        </p>
                      )}

                      <p className="text-xs text-ink-faint">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>

                      {/* Action Buttons */}
                      {notification.status === 'unread' && notification.type === 'friend_request' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptFriendRequest(
                                notification.id,
                                notification.data.friendship_id
                              );
                            }}
                            className="flex-1 px-3 py-1.5 bg-teal hover:bg-teal/90 text-canvas text-sm font-semibold rounded-lg transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 inline mr-1" />
                            Accept
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeclineFriendRequest(
                                notification.id,
                                notification.data.friendship_id
                              );
                            }}
                            className="flex-1 px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink text-sm font-medium rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5 inline mr-1" />
                            Decline
                          </button>
                        </div>
                      )}

                      {notification.status === 'unread' && notification.type === 'match_challenge' && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptChallenge(
                                notification.id, 
                                notification.sender_id,
                                notification.data?.challenge_id
                              );
                            }}
                            className="flex-1 px-3 py-1.5 bg-orange hover:bg-orange/90 text-canvas text-sm font-semibold rounded-lg transition-colors"
                          >
                            <Swords className="w-3.5 h-3.5 inline mr-1" />
                            Accept Challenge
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeclineChallenge(notification.id);
                            }}
                            className="px-3 py-1.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink text-sm font-medium rounded-lg transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {notification.status === 'accepted' && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-teal/20 text-teal text-xs font-medium rounded">
                          <Check className="w-3 h-3" />
                          Accepted
                        </span>
                      )}

                      {notification.status === 'declined' && (
                        <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-ink-faint/20 text-ink-muted text-xs font-medium rounded">
                          <X className="w-3 h-3" />
                          Declined
                        </span>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="shrink-0 p-1 hover:bg-[var(--surface-hover)] rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-ink-faint" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
