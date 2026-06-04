"use client";
import { useEffect, useState } from "react";

/**
 * Hydration-safe "now" for client components that render relative
 * timestamps. Returns `null` during SSR / first paint, then the live client
 * `Date.now()` after mount. Refreshes every `intervalMs` (default 60s) so
 * "5 minutes ago" rolls to "6 minutes ago" without a page refresh.
 */
export function useRelativeNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
