import { useNavigate } from '@tanstack/react-router';

interface ClickableUsernameProps {
  username: string;
  walletAddress: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable component that makes usernames clickable and navigates to user profile
 */
export function ClickableUsername({ username, walletAddress, className = '', children }: ClickableUsernameProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate({ to: '/user/$address', params: { address: walletAddress } });
  };

  return (
    <button
      onClick={handleClick}
      className={`text-left hover:text-orange transition-colors cursor-pointer ${className}`}
      title={`View ${username}'s profile`}
    >
      {children || username}
    </button>
  );
}
