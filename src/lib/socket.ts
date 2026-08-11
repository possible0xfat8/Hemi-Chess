import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from './config';

let socket: Socket | null = null;
let connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
let statusListeners: Set<(status: 'connected' | 'disconnected' | 'connecting') => void> = new Set();
let currentBackendUrl: string | null = null;
let backendUrlListenerRegistered = false;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    // SSR: return a mock
    return null as any;
  }

  const backendUrl = getBackendUrl();

  // If URL changed, disconnect old socket and create new one
  if (socket && currentBackendUrl !== backendUrl) {
    console.log('[SOCKET] Backend URL changed, reconnecting...');
    console.log('[SOCKET]   Old:', currentBackendUrl);
    console.log('[SOCKET]   New:', backendUrl);
    disconnectSocket();
    socket = null;
    backendUrlListenerRegistered = false;
  }

  if (!socket) {
    currentBackendUrl = backendUrl;
    console.log('[SOCKET] Initializing persistent connection to:', backendUrl);
    
    // NOTE: Removed automatic authoritative URL fetching
    // The server's config is now managed via explicit admin actions
    // Non-admin users will receive URL updates via WebSocket broadcasts
    
    socket = io(backendUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[SOCKET] ✓ Connected to server');
      updateConnectionStatus('connected');
      
      // Auto-register player when wallet is connected
      // This will be called by each component that needs it
      // The registration event can be emitted multiple times safely
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] ✗ Disconnected:', reason);
      updateConnectionStatus('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.log('[SOCKET] Connection error:', error.message);
      updateConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log('[SOCKET] Reconnect attempt:', attempt);
      updateConnectionStatus('connecting');
    });

    socket.on('reconnect', (attempt) => {
      console.log('[SOCKET] Reconnected after', attempt, 'attempts');
      updateConnectionStatus('connected');
    });

    // Initial status
    updateConnectionStatus(socket.connected ? 'connected' : 'connecting');
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    console.log('[SOCKET] Disconnecting from server...');
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentBackendUrl = null;
    updateConnectionStatus('disconnected');
  }
}

export function reconnectSocket(): void {
  console.log('[SOCKET] Force reconnecting socket...');
  disconnectSocket();
  getSocket();
}

export function getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
  return connectionStatus;
}

export function subscribeToConnectionStatus(
  listener: (status: 'connected' | 'disconnected' | 'connecting') => void
): () => void {
  statusListeners.add(listener);
  // Immediately call with current status
  listener(connectionStatus);
  
  // Return unsubscribe function
  return () => {
    statusListeners.delete(listener);
  };
}

function updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting') {
  connectionStatus = status;
  statusListeners.forEach(listener => listener(status));
}

// Helper function to register player as online
export function registerPlayerOnline(walletAddress: string, playerName?: string): void {
  const socket = getSocket();
  if (socket && socket.connected && walletAddress) {
    socket.emit('register_player', {
      walletAddress: walletAddress.toLowerCase(),
      playerName
    });
    console.log('[SOCKET] Registered player as online:', walletAddress.slice(0, 10) + '...');
  }
}
