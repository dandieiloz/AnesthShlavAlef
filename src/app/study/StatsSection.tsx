import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usefulnessTone, TONE_ROW_CLASS, TONE_BADGE_CLASS, toneLabel } from "@/lib/usefulness";
import { getActivityHeatmap, getCurrentStreak } from "@/lib/activity";
import { Target, TrendingUp, BookOpen, Flame } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { getTranslatedFields } from "@/lib/translate";
import { HospitalPieChart, type HospitalSlice } from "./HospitalPieChart";
import type { ReactNode } from "react";

const CHAPTER_SORT_FIELDS = ["chapter", "title", "attempts", "correct", "accuracy", "usefulness"] as const;
type ChapterSortField = (typeof CHAPTER_SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

function isChapterSortField(value: string | undefined): value is ChapterSortField {
  return value !== undefined && CHAPTER_SORT_FIELDS.includes(value as ChapterSortField);
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export async function StatsSection({
  userId,
  locale,
  searchParams,
  isAdmin = false,
  children,
}: {
  userId: string;
  locale: Locale;
  searchParams?: Record<string, string | string[] | undefined>;
  isAdmin?: boolean;
  children?: ReactNode;
}) {
  const dict = getDictionary(locale);
  const t = dict.dashboard;
  const chapterSort: ChapterSortField = isChapterSortField(
    typeof searchParams?.chapterSort === "string" ? searchParams.chapterSort : undefined,
  )
    ? (searchParams!.chapterSort as ChapterSortField)
    : "chapter";
  const chapterOrder: SortOrder =
    typeof searchParams?.chapterOrder === "string" && searchParams.chapterOrder === "desc" ? "desc" : "asc";

  const [attempts, heatmapData, hospitalRows] = await Promise.all([
    db.attempt.findMany({
      where: { userId },
      include: { question: { include: { chapter: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getActivityHeatmap(userId, 120),
    db.$queryRaw<Array<{ hospitalName: string | null; solved: bigint; residents: bigint }>>`
      SELECT u."hospitalName" AS "hospitalName", COUNT(*) AS "solved", COUNT(DISTINCT a."userId") AS "residents"
      FROM "Attempt" a
      JOIN "User" u ON u."id" = a."userId"
      WHERE a."createdAt" >= now() - interval '24 hours'
      GROUP BY u."hospitalName"
    `,
  ]);

  // Community pie chart: questions answered in the last 24h, grouped by hospital.
  // Keep the top hospitals as their own slices and fold the rest into "Other".
  const TOP_HOSPITALS = 8;
  const hospitalCounts = hospitalRows
    .map((r) => ({
      name: r.hospitalName ?? t.hospitalChartNoHospital,
      value: Number(r.solved),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  let hospitalChartData: HospitalSlice[] = hospitalCounts;
  if (hospitalCounts.length > TOP_HOSPITALS) {
    const top = hospitalCounts.slice(0, TOP_HOSPITALS);
    const otherValue = hospitalCounts
      .slice(TOP_HOSPITALS)
      .reduce((sum, d) => sum + d.value, 0);
    hospitalChartData = [...top, { name: t.hospitalChartOther, value: otherValue }];
  }

  // Community summary (shown to regular users): totals across the last 24h.
  const communitySolved = hospitalRows.reduce((sum, r) => sum + Number(r.solved), 0);
  const communityResidents = hospitalRows.reduce((sum, r) => sum + Number(r.residents), 0);
  const communityHospitals = hospitalRows.filter(
    (r) => r.hospitalName !== null && Number(r.solved) > 0,
  ).length;

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

  const chapterEntries = [...byChapter.entries()];
  const chapterTitleTranslations = await Promise.all(
    chapterEntries.map(([num, r]) =>
      getTranslatedFields("Chapter", `n:${num}`, { title: r.title }, locale),
    ),
  );

  const chapterRows = chapterEntries.map(([num, r], i) => ({
    chapterNumber: num,
    title: chapterTitleTranslations[i].title,
    attempts: r.total,
    correct: r.correct,
    accuracy: Math.round((r.correct / r.total) * 100),
    usefulness: r.learningUsefulnessIndex,
  }));

  const sortedChapterRows = [...chapterRows].sort((a, b) => {
    let cmp = 0;
    switch (chapterSort) {
      case "chapter":
        cmp = a.chapterNumber - b.chapterNumber;
        break;
      case "title":
        cmp = a.title.localeCompare(b.title, locale);
        break;
      case "attempts":
        cmp = a.attempts - b.attempts;
        break;
      case "correct":
        cmp = a.correct - b.correct;
        break;
      case "accuracy":
        cmp = a.accuracy - b.accuracy;
        break;
      case "usefulness":
        cmp = compareNullableNumber(a.usefulness, b.usefulness);
        break;
    }

    if (cmp === 0) {
      cmp = a.chapterNumber - b.chapterNumber;
    }

    return chapterOrder === "asc" ? cmp : -cmp;
  });

  function sortHref(field: ChapterSortField) {
    const nextParams = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (typeof value === "string") nextParams.set(key, value);
    }

    const nextOrder: SortOrder =
      chapterSort === field
        ? chapterOrder === "asc"
          ? "desc"
          : "asc"
        : "asc";

    nextParams.set("chapterSort", field);
    nextParams.set("chapterOrder", nextOrder);

    const query = nextParams.toString();
    return query ? `/study?${query}` : "/study";
  }

  function sortIndicator(field: ChapterSortField) {
    if (chapterSort !== field) return "";
    return chapterOrder === "asc" ? "▲" : "▼";
  }

  function SortHead({
    field,
    label,
    className,
  }: {
    field: ChapterSortField;
    label: string;
    className?: string;
  }) {
    return (
      <TableHead className={className}>
        <Link href={sortHref(field)} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
          <span>{label}</span>
          <span aria-hidden="true" className="text-xs">{sortIndicator(field)}</span>
        </Link>
      </TableHead>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">סטטיסטיקה</h2>
        <p className="mt-1 text-sm text-muted-foreground">סיכום הביצועים שלך עד כה.</p>
      </div>

      {/* Stat cards + community hospital chart (chart is admin-only for now) */}
      <div className={isAdmin ? "grid gap-4 lg:grid-cols-2" : ""}>
        <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "" : "lg:grid-cols-4"}`}>
          <StatCard label="סה״כ שאלות" value={total} icon={Target} />
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

        {/* Community: questions solved by hospital (last 24h) — admin-only for now */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t.hospitalChartTitle}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{t.hospitalChartSubtitle}</p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {hospitalChartData.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.hospitalChartEmpty}</p>
              ) : (
                <HospitalPieChart data={hospitalChartData} questionsLabel={t.hospitalChartQuestions} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Community summary sentence (regular users) */}
      {!isAdmin && (
        <div className="rounded-xl bg-gradient-to-l from-primary/10 via-primary/5 to-transparent border border-primary/20 px-4 py-3">
          {communitySolved === 0 ? (
            <p className="text-sm text-muted-foreground text-center">{t.hospitalSummaryEmpty}</p>
          ) : (
            <p
              className="text-sm sm:text-base font-medium text-center leading-relaxed"
              dir={locale === "he" ? "rtl" : "ltr"}
            >
              {locale === "he" ? "היום עד כה נפתרו " : "Today so far, "}
              <SummaryNum value={communitySolved} locale={locale} colorClass="text-primary" />
              {locale === "he" ? " שאלות על ידי " : " questions have been solved by "}
              <SummaryNum value={communityResidents} locale={locale} colorClass="text-success" />
              {locale === "he" ? " מתמחים מ-" : " residents from "}
              <SummaryNum value={communityHospitals} locale={locale} colorClass="text-orange-500" />
              {locale === "he" ? " בתי חולים" : " hospitals"}
            </p>
          )}
        </div>
      )}

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
                  <SortHead field="chapter" label={t.chapterCol} className="w-12 text-center" />
                  <SortHead field="title" label={t.titleCol} />
                  <SortHead field="attempts" label={t.attemptsCol} className="w-20 text-center" />
                  <SortHead field="correct" label={t.correctCol} className="w-20 text-center" />
                  <SortHead field="accuracy" label={t.accuracyCol} className="w-24 text-center" />
                  <SortHead field="usefulness" label={t.usefulnessCol} className="w-32 text-center" />
                  <TableHead className="w-20 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedChapterRows
                  .map((row) => {
                    const tone = usefulnessTone(row.usefulness);
                    return (
                      <TableRow key={row.chapterNumber} className={TONE_ROW_CLASS[tone]}>
                        <TableCell className="text-center font-mono text-sm font-medium">{row.chapterNumber}</TableCell>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{row.attempts}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{row.correct}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  row.accuracy >= 70 ? "bg-success" : row.accuracy >= 50 ? "bg-warning" : "bg-destructive"
                                }`}
                                style={{ width: `${row.accuracy}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums">{row.accuracy}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-xs ${TONE_BADGE_CLASS[tone]}`}>
                            {toneLabel(tone, locale)}
                            {row.usefulness !== null && (
                              <span className="opacity-60 ms-1">({row.usefulness})</span>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-primary">
                            <Link href={`/study/new?chapter=${row.chapterNumber}`}>{dict.common.practice}</Link>
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

function SummaryNum({
  value,
  locale,
  colorClass,
}: {
  value: number;
  locale: Locale;
  colorClass: string;
}) {
  return (
    <span className={`font-display text-lg font-bold ${colorClass}`}>
      {value.toLocaleString(locale)}
    </span>
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
