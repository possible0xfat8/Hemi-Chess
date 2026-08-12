import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackText?: string;
  showOnline?: boolean;
  isOnline?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

const onlineIndicatorSizes = {
  xs: 'w-1.5 h-1.5 -right-0.5 -bottom-0.5',
  sm: 'w-2 h-2 -right-0.5 -bottom-0.5',
  md: 'w-3 h-3 -right-0.5 -bottom-0.5',
  lg: 'w-4 h-4 -right-1 -bottom-1',
  xl: 'w-5 h-5 -right-1 -bottom-1',
};

export function Avatar({ src, alt, size = 'md', className = '', fallbackText, showOnline = false, isOnline = false }: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const showImage = src && !imageError;
  const initial = fallbackText?.charAt(0).toUpperCase() || alt?.charAt(0).toUpperCase() || '?';

  return (
    <div className="relative inline-block shrink-0">
      <div 
        className={`relative rounded-full overflow-hidden bg-gradient-to-br from-[var(--surface-strong)] to-[var(--surface-strong)] ring-1 ring-line flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
      >
        {showImage ? (
          <>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-strong)]">
                <div className="w-4 h-4 border-2 border-line border-t-orange rounded-full animate-spin" />
              </div>
            )}
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-cover"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src="/default-avatar.svg"
              alt={alt}
              className="w-full h-full object-cover opacity-60"
            />
            <span className="absolute font-bold text-orange">
              {initial}
            </span>
          </div>
      )}
      </div>
      
      {/* Online indicator */}
      {showOnline && (
        <span 
          className={`absolute rounded-full ring-2 ring-[var(--bg-base)] ${onlineIndicatorSizes[size]} ${
            isOnline ? 'bg-teal animate-pulse' : 'bg-ink-faint'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
