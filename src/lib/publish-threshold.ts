import { db } from "@/lib/db";
import { cached, invalidate } from "@/lib/ttl-cache";

const CACHE_TTL_MS = 60_000;

const KEY = "publishConfidenceThreshold";
export const DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD = 0.7;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD;
  return Math.max(0, Math.min(1, n));
}

export async function getPublishConfidenceThreshold(): Promise<number> {
  return cached(`site:${KEY}`, CACHE_TTL_MS, async () => {
    const row = await db.siteContent.findUnique({ where: { key: KEY } });
    if (!row) return DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD;
    return clamp01(Number(row.value));
  });
}

export async function setPublishConfidenceThreshold(value: number): Promise<number> {
  const v = clamp01(Number(value));
  await db.siteContent.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(v) },
    update: { value: String(v) },
  });
  invalidate(`site:${KEY}`);
  return v;
}
