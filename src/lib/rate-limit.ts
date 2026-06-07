import "server-only";

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function sweep(now: number): void {
  for (const [key, w] of buckets) {
    if (now >= w.resetAt) buckets.delete(key);
  }
}

/**
 * Simple in-memory fixed-window rate limiter.
 *
 * NOTE: per-instance only — a best-effort mitigation against casual spam on
 * public endpoints, not a hard guarantee across serverless instances.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (buckets.size > 1000) sweep(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}
