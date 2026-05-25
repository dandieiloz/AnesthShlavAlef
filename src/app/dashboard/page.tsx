import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usefulnessTone, TONE_ROW_CLASS, TONE_BADGE_CLASS, TONE_LABEL } from "@/lib/usefulness";
import { getActivityHeatmap, getAccuracyOverTime, getCurrentStreak } from "@/lib/activity";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { AccuracyTrend } from "@/components/charts/AccuracyTrend";
import { Target, CheckCircle2, TrendingUp, BookOpen, Flame, Bookmark, ArrowLeft } from "lucide-react";

export default async function Dashboard() {
  const me = await requireCompletedProfile();

  const [attempts, heatmapData, recentBookmarks] = await Promise.all([
    db.attempt.findMany({
      where: { userId: me.id },
      include: { question: { include: { chapter: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getActivityHeatmap(me.id, 120),
    db.bookmark.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        question: {
          select: {
            id: true,
            stem: true,
            chapter: { select: { number: true, title: true } },
          },
        },
      },
    }),
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
  const trendData = getAccuracyOverTime(heatmapData);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">סטטיסטיקה</h1>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">פעילות 120 ימים אחרונים</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {heatmapData.some((d) => d.count > 0) ? (
              <ActivityHeatmap data={heatmapData} />
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                עדיין אין פעילות. <Link href="/study/new" className="text-primary hover:underline">התחל מבחן</Link>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bookmarks panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                שאלות שסומנו
              </span>
              {recentBookmarks.length > 0 && (
                <Link href="/bookmarks" className="flex items-center gap-1 text-xs hover:text-foreground transition-colors">
                  כל הסימניות
                  <ArrowLeft className="h-3 w-3" />
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookmarks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                סמן שאלות במהלך מבחן כדי שיופיעו כאן
              </p>
            ) : (
              <ul className="space-y-2">
                {recentBookmarks.map((b) => (
                  <li key={b.id}>
                    <Link href={`/quiz`} className="block rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors">
                      <p className="font-medium line-clamp-2">{b.question.stem}</p>
                      <p className="text-muted-foreground mt-0.5">
                        פרק {b.question.chapter.number} — {b.question.chapter.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accuracy trend */}
      {trendData.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              דיוק גלגולי (חלון 7 ימים)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyTrend data={trendData} />
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 border-t border-dashed border-success/60" />
                70% יעד
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 border-t border-dashed border-warning/60" />
                50%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-chapter table */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold">פילוח לפי פרק</h2>

        {byChapter.size === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              עדיין אין נתונים.{" "}
              <Link href="/study/new" className="text-primary hover:underline">התחילו מבחן</Link>.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">פרק</TableHead>
                  <TableHead>כותרת</TableHead>
                  <TableHead className="w-20 text-center">ניסיונות</TableHead>
                  <TableHead className="w-20 text-center">נכון</TableHead>
                  <TableHead className="w-24 text-center">דיוק</TableHead>
                  <TableHead className="w-32 text-center">מועילות</TableHead>
                  <TableHead className="w-20 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...byChapter.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([num, r]) => {
                    const tone = usefulnessTone(r.learningUsefulnessIndex);
                    const pct = Math.round((r.correct / r.total) * 100);
                    return (
                      <TableRow key={num} className={TONE_ROW_CLASS[tone]}>
                        <TableCell className="text-center font-mono text-sm font-medium">{num}</TableCell>
                        <TableCell className="font-medium">{r.title}</TableCell>
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
                            {TONE_LABEL[tone]}
                            {r.learningUsefulnessIndex !== null && (
                              <span className="opacity-60 ms-1">({r.learningUsefulnessIndex})</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-primary">
                            <Link href={`/study/new?chapter=${num}`}>תרגל</Link>
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
