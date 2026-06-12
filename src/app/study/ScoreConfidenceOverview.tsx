import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { ConfidenceLevel } from "@/lib/scores/types";
import { SCORE_SYSTEMS } from "@/lib/scores/registry";

/**
 * Compact summary of the user's self-rated confidence across all clinical
 * scores, with a shortcut into a targeted drill of the weak/unrated ones.
 * Rendered on /study.
 */
export async function ScoreConfidenceOverview({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const t = getDictionary(locale).scores;
  const rows = await db.scoreConfidence.findMany({
    where: { userId },
    select: { scoreId: true, level: true },
  });
  const byId = new Map<string, ConfidenceLevel>(rows.map((r) => [r.scoreId, r.level]));

  let confident = 0;
  let ok = 0;
  let weak = 0;
  const weakOrUnrated: string[] = [];
  for (const s of SCORE_SYSTEMS) {
    const level = byId.get(s.id);
    if (level === "CONFIDENT") confident += 1;
    else if (level === "OK") ok += 1;
    else if (level === "WEAK") {
      weak += 1;
      weakOrUnrated.push(s.id);
    } else {
      weakOrUnrated.push(s.id);
    }
  }
  const unrated = SCORE_SYSTEMS.length - confident - ok - weak;
  const hasAny = rows.length > 0;
  const weakHref = `/study/scores?scores=${weakOrUnrated.join(",")}&count=10`;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {t.overviewTitle}
          </h2>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href="/study/new?mode=scores">{t.overviewPractice}</Link>
          </Button>
        </div>

        {hasAny ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{t.countConfident(confident)}</Badge>
              <Badge variant="warning">{t.countOk(ok)}</Badge>
              <Badge variant="destructive">{t.countWeak(weak)}</Badge>
              <Badge variant="outline">{t.countUnrated(unrated)}</Badge>
            </div>
            {weakOrUnrated.length > 0 && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={weakHref}>
                  <Wand2 className="h-3.5 w-3.5" />
                  {t.overviewPracticeWeak}
                </Link>
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t.overviewEmpty}</p>
        )}
      </CardContent>
    </Card>
  );
}
