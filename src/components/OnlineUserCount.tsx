import { useOnlineCount } from '@/hooks/useOnlineStatus';
import { Users } from 'lucide-react';

interface OnlineUserCountProps {
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function OnlineUserCount({ className = '', showIcon = true, size = 'md' }: OnlineUserCountProps) {
  const { count, loading } = useOnlineCount();

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (loading && count === 0) {
    return (
      <div className={`flex items-center gap-1.5 ${sizeClasses[size]} text-ink-muted ${className}`}>
        {showIcon && <Users className={`${iconSizes[size]} animate-pulse`} />}
        <span className="animate-pulse">...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${sizeClasses[size]} ${className}`}>
      {showIcon && <Users className={`${iconSizes[size]} text-green-500`} />}
      <span className="font-medium text-ink">
        {count.toLocaleString()}
      </span>
      <span className="text-ink-muted">
        {count === 1 ? 'player online' : 'players online'}
      </span>
    </div>
  );
}
