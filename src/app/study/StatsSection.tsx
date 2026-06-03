import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usefulnessTone, TONE_ROW_CLASS, TONE_BADGE_CLASS, toneLabel } from "@/lib/usefulness";
import { getActivityHeatmap, getCurrentStreak } from "@/lib/activity";
import { Target, CheckCircle2, TrendingUp, BookOpen, Flame } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { getTranslatedFields } from "@/lib/translate";
import type { ReactNode } from "react";

export async function StatsSection({ userId, locale, children }: { userId: string; locale: Locale; children?: ReactNode }) {
  const dict = getDictionary(locale);
  const t = dict.dashboard;

  const [attempts, heatmapData] = await Promise.all([
    db.attempt.findMany({
      where: { userId },
      include: { question: { include: { chapter: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getActivityHeatmap(userId, 120),
  ]);

  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

  const byChapter = new Map<
    number,
    { title: string; total: number; correct: number; learningUsefulnessIndex: number | null }
  >();
  for (const a of attempts) {
    const key = a.question.chapter.number;
    const row = byChapter.get(key) ?? {
      title: a.question.chapter.title,
      total: 0,
      correct: 0,
      learningUsefulnessIndex: a.question.chapter.learningUsefulnessIndex,
    };
    row.total++;
    if (a.isCorrect) row.correct++;
    byChapter.set(key, row);
  }

  const chaptersAttempted = byChapter.size;
  const streak = getCurrentStreak(heatmapData);

  const chapterEntries = [...byChapter.entries()].sort((a, b) => a[0] - b[0]);
  const chapterTitleTranslations = await Promise.all(
    chapterEntries.map(([num, r]) =>
      getTranslatedFields("Chapter", `n:${num}`, { title: r.title }, locale),
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">סטטיסטיקה</h2>
        <p className="mt-1 text-sm text-muted-foreground">סיכום הביצועים שלך עד כה.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="סה״כ שאלות" value={total} icon={Target} />
        <StatCard label="תשובות נכונות" value={correct} icon={CheckCircle2} colorClass="text-success" />
        <StatCard
          label="אחוז הצלחה"
          value={`${accuracy}%`}
          icon={TrendingUp}
          colorClass={accuracy >= 70 ? "text-success" : accuracy >= 50 ? "text-warning" : "text-destructive"}
        />
        <StatCard label="פרקים תורגלו" value={chaptersAttempted} icon={BookOpen} />
        <StatCard
          label="רצף ימים"
          value={`${streak} 🔥`}
          icon={Flame}
          colorClass={streak > 0 ? "text-orange-500" : "text-muted-foreground"}
        />
      </div>

      {children}

      {/* Per-chapter table */}
      <div className="space-y-3">
        <h3 className="font-display text-base font-semibold">{t.byChapter}</h3>

        {byChapter.size === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              {t.noData}
              <Link href="/study/new" className="text-primary hover:underline">{t.startQuiz}</Link>.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">{t.chapterCol}</TableHead>
                  <TableHead>{t.titleCol}</TableHead>
                  <TableHead className="w-20 text-center">{t.attemptsCol}</TableHead>
                  <TableHead className="w-20 text-center">{t.correctCol}</TableHead>
                  <TableHead className="w-24 text-center">{t.accuracyCol}</TableHead>
                  <TableHead className="w-32 text-center">{t.usefulnessCol}</TableHead>
                  <TableHead className="w-20 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {chapterEntries
                  .map(([num, r], i) => {
                    const tone = usefulnessTone(r.learningUsefulnessIndex);
                    const pct = Math.round((r.correct / r.total) * 100);
                    return (
                      <TableRow key={num} className={TONE_ROW_CLASS[tone]}>
                        <TableCell className="text-center font-mono text-sm font-medium">{num}</TableCell>
                        <TableCell className="font-medium">{chapterTitleTranslations[i].title}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{r.total}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{r.correct}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${TONE_BADGE_CLASS[tone]}`}>
                            {toneLabel(tone, locale)}
                            {r.learningUsefulnessIndex !== null && (
                              <span className="opacity-60 ms-1">({r.learningUsefulnessIndex})</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-primary">
                            <Link href={`/study/new?chapter=${num}`}>{dict.common.practice}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass = "text-primary",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {label}
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-display text-3xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
