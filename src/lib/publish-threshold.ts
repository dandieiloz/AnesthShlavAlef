import { db } from "@/lib/db";

const KEY = "publishConfidenceThreshold";
export const DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD = 0.7;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD;
  return Math.max(0, Math.min(1, n));
}

export async function getPublishConfidenceThreshold(): Promise<number> {
  const row = await db.siteContent.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_PUBLISH_CONFIDENCE_THRESHOLD;
  const n = Number(row.value);
  return clamp01(n);
}

export async function setPublishConfidenceThreshold(value: number): Promise<number> {
  const v = clamp01(Number(value));
  await db.siteContent.upsert({
    where: { key: KEY },
    create: { key: KEY, value: String(v) },
    update: { value: String(v) },
  });
  return v;
}
