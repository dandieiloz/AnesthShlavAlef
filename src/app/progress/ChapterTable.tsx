import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usefulnessTone, TONE_ROW_CLASS, TONE_BADGE_CLASS, toneLabel } from "@/lib/usefulness";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

const CHAPTER_SORT_FIELDS = ["chapter", "title", "attempts", "correct", "accuracy", "usefulness"] as const;
type ChapterSortField = (typeof CHAPTER_SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

export interface ChapterStatRow {
  chapterNumber: number;
  title: string;
  attempts: number;
  correct: number;
  accuracy: number;
  usefulness: number | null;
}

function isChapterSortField(value: unknown): value is ChapterSortField {
  return typeof value === "string" && CHAPTER_SORT_FIELDS.includes(value as ChapterSortField);
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** Per-chapter performance table with server-side (URL) sorting. */
export function ChapterTable({
  rows,
  locale,
  basePath,
  searchParams,
}: {
  rows: ChapterStatRow[];
  locale: Locale;
  basePath: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const dict = getDictionary(locale);
  const t = dict.dashboard;
  const chapterSort: ChapterSortField = isChapterSortField(searchParams?.chapterSort)
    ? searchParams!.chapterSort as ChapterSortField
    : "chapter";
  const chapterOrder: SortOrder = searchParams?.chapterOrder === "desc" ? "desc" : "asc";

  const sorted = [...rows].sort((a, b) => {
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
    if (cmp === 0) cmp = a.chapterNumber - b.chapterNumber;
    return chapterOrder === "asc" ? cmp : -cmp;
  });

  function sortHref(field: ChapterSortField) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (typeof value === "string") next.set(key, value);
    }
    const nextOrder: SortOrder = chapterSort === field ? (chapterOrder === "asc" ? "desc" : "asc") : "asc";
    next.set("chapterSort", field);
    next.set("chapterOrder", nextOrder);
    return `${basePath}?${next.toString()}#chapters`;
  }

  function SortHead({ field, label, className }: { field: ChapterSortField; label: string; className?: string }) {
    const indicator = chapterSort !== field ? "" : chapterOrder === "asc" ? "▲" : "▼";
    return (
      <TableHead className={className}>
        <Link href={sortHref(field)} scroll={false} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
          <span>{label}</span>
          <span aria-hidden="true" className="text-xs">{indicator}</span>
        </Link>
      </TableHead>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          {t.noData}
          <Link href="/study/new" className="text-primary hover:underline">{t.startQuiz}</Link>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <SortHead field="chapter" label={t.chapterCol} className="w-12 text-center" />
            <SortHead field="title" label={t.titleCol} />
            <SortHead field="attempts" label={t.attemptsCol} className="w-20 text-center" />
            <SortHead field="correct" label={t.correctCol} className="w-20 text-center" />
            <SortHead field="accuracy" label={t.accuracyCol} className="w-28 text-center" />
            <SortHead field="usefulness" label={t.usefulnessCol} className="w-32 text-center" />
            <TableHead className="w-20 text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => {
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
                    {row.usefulness !== null && <span className="ms-1 opacity-60">({row.usefulness})</span>}
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
  );
}
