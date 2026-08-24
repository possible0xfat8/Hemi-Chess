import { useState } from 'react';
import { useMyOnlineStatus } from '@/hooks/useOnlineStatus';
import { Eye, EyeOff, Circle } from 'lucide-react';

export function OnlineStatusToggle() {
  const { statusPreference, setStatusPreference, updating } = useMyOnlineStatus();
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions = [
    {
      value: 'online' as const,
      label: 'Online',
      icon: Circle,
      description: 'Show as online to everyone',
      color: 'text-green-500',
    },
    {
      value: 'appear_offline' as const,
      label: 'Appear Offline',
      icon: EyeOff,
      description: 'Hide your online status',
      color: 'text-ink-muted',
    },
  ];

  const currentStatus = statusOptions.find(s => s.value === statusPreference) ?? statusOptions[0]!;

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={updating}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line rounded-lg transition-colors disabled:opacity-50"
        title="Change online status"
      >
        <currentStatus.icon className={`w-4 h-4 ${currentStatus.color}`} />
        <span className="text-sm font-medium">{currentStatus.label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full mt-2 right-0 z-50 w-64 bg-[var(--surface)] border border-line rounded-lg shadow-xl overflow-hidden">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatusPreference(option.value);
                  setIsOpen(false);
                }}
                disabled={updating}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 ${
                  statusPreference === option.value ? 'bg-[var(--surface-strong)]' : ''
                }`}
              >
                <option.icon className={`w-5 h-5 ${option.color} mt-0.5 shrink-0`} />
                <div className="flex-1 text-left">
                  <div className="font-medium text-ink text-sm">{option.label}</div>
                  <div className="text-xs text-ink-muted mt-0.5">{option.description}</div>
                </div>
                {statusPreference === option.value && (
                  <svg 
                    className="w-5 h-5 text-orange shrink-0 mt-0.5" 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
