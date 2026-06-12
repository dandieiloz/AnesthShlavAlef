import { requireCompletedProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { getScoreById, SCORE_SYSTEMS } from "@/lib/scores/registry";
import type { ConfidenceLevel } from "@/lib/scores/types";
import { ScoreDrillRunner } from "./ScoreDrillRunner";

export default async function ScoreDrillPage({
  searchParams,
}: {
  searchParams: Promise<{ scores?: string; count?: string }>;
}) {
  const me = await requireCompletedProfile();
  const { scores: scoresParam, count: countParam } = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale).scores;

  // Validate requested score ids against the registry; fall back to all.
  const requested = (scoresParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let validIds = requested.filter((id) => getScoreById(id));
  if (validIds.length === 0) validIds = SCORE_SYSTEMS.map((s) => s.id);

  const parsedCount = Number(countParam);
  const count = Number.isFinite(parsedCount)
    ? Math.min(50, Math.max(1, Math.round(parsedCount)))
    : 10;

  const rows = await db.scoreConfidence.findMany({
    where: { userId: me.id, scoreId: { in: validIds } },
    select: { scoreId: true, level: true },
  });
  const confidence: Record<string, ConfidenceLevel> = {};
  for (const r of rows) confidence[r.scoreId] = r.level;

  const BackIcon = locale === "he" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/study"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackIcon className="h-4 w-4" />
          {t.backToStudy}
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <ScoreDrillRunner scoreIds={validIds} count={count} locale={locale} confidence={confidence} />
    </div>
  );
}
