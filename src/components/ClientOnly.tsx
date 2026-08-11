import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children only after hydration. Wallet + socket code touches
 * window/localStorage, so it must not run during SSR.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
