import { useEffect, useState } from 'react';
import { getSocket, subscribeToConnectionStatus } from '@/lib/socket';

export function ServerStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    // Initialize socket connection
    getSocket();
    
    // Subscribe to status changes
    const unsubscribe = subscribeToConnectionStatus(setStatus);
    
    return unsubscribe;
  }, []);

  const statusConfig = {
    connected: {
      color: 'var(--accent-teal)',
      animate: false,
      label: 'Connected to server',
    },
    disconnected: {
      color: 'var(--accent-danger)',
      animate: true,
      label: 'Disconnected from server',
    },
    connecting: {
      color: 'var(--accent-orange)',
      animate: true,
      label: 'Connecting to server...',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="group relative">
      <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full cursor-help">
        <div className="relative flex h-2 w-2">
          {config.animate && (
            <span 
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: config.color }}
            ></span>
          )}
          <span 
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: config.color }}
          ></span>
        </div>
        <span className="text-xs font-medium text-slate-300 hidden sm:inline">Server</span>
      </div>

      {/* Tooltip */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
        <div className="text-xs font-medium text-slate-200">{config.label}</div>
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 rotate-45"></div>
      </div>
    </div>
  );
}
