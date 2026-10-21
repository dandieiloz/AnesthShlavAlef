/**
 * Tiny in-memory cache for slow-changing, site-wide values (admin settings,
 * derived lists). Each server instance keeps its own copy for `ttlMs`, and
 * concurrent callers share one in-flight load, so a page that asks for the
 * same value several times only hits the database once.
 *
 * Setters should call `invalidate(key)` so the instance that handled the
 * admin change sees it immediately; other instances catch up within the TTL.
 */
type Entry = { value?: unknown; expiresAt: number; pending?: Promise<unknown> };

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && "value" in hit && hit.expiresAt > now) return hit.value as T;
  if (hit?.pending) return hit.pending as Promise<T>;

  const pending = load()
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });
  store.set(key, { ...(hit ?? { expiresAt: 0 }), pending });
  return pending;
}

export function invalidate(...keys: string[]) {
  for (const k of keys) store.delete(k);
}
