import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HOSPITALS, OFFICIAL_EXAM_SOURCE, UNKNOWN_SOURCE } from "@/lib/hospitals";
import { AdminNav } from "../AdminNav";
import { DemoPlanClient, type SourceRow } from "./DemoPlanClient";
import { NULL_SOURCE_SENTINEL } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function DemoPlanPage() {
  await requireAdmin();

  const [allowedRows, demoUserCount, sourceCounts, nullSourceCount] = await Promise.all([
    db.demoAllowedSource.findMany({ select: { source: true } }),
    db.user.count({ where: { plan: "DEMO" } }),
    db.question.groupBy({
      by: ["source"],
      _count: { _all: true },
      where: { source: { not: null } },
    }),
    db.question.count({ where: { source: null } }),
  ]);

  const allowedSet = new Set(allowedRows.map((r) => r.source));

  const countMap = new Map<string, number>();
  for (const r of sourceCounts) {
    if (r.source) countMap.set(r.source, r._count._all);
  }

  const sortedHospitals = [...HOSPITALS].sort((a, b) => b.length - a.length);

  function groupOf(source: string): SourceRow["group"] {
    if (source.startsWith(OFFICIAL_EXAM_SOURCE)) return "official";
    if (sortedHospitals.some((h) => source === h || source.startsWith(h + " ")))
      return "hospital";
    return "other";
  }

  function labelOf(source: string): string {
    if (source === NULL_SOURCE_SENTINEL) return "שאלות ללא מקור";
    if (source === UNKNOWN_SOURCE) return "מקור לא ידוע";
    return source;
  }

  // Real sources that actually exist on questions (the allowlist gates by exact
  // source string, so only real values are meaningful), plus any pre-allowed
  // source from the DB that currently has no questions, plus the null sentinel.
  const sourceSet = new Set<string>(countMap.keys());
  for (const s of allowedSet) {
    if (s !== NULL_SOURCE_SENTINEL) sourceSet.add(s);
  }

  const rows: SourceRow[] = [
    ...[...sourceSet].map((s) => ({
      source: s,
      label: labelOf(s),
      allowed: allowedSet.has(s),
      questionCount: countMap.get(s) ?? 0,
      group: groupOf(s),
    })),
    {
      source: NULL_SOURCE_SENTINEL,
      label: labelOf(NULL_SOURCE_SENTINEL),
      allowed: allowedSet.has(NULL_SOURCE_SENTINEL),
      questionCount: nullSourceCount,
      group: "other" as const,
    },
  ];

  const allowedQuestionTotal = rows
    .filter((r) => r.allowed)
    .reduce((sum, r) => sum + r.questionCount, 0);

  return (
    <div className="space-y-4">
      <AdminNav />
      <div>
        <h1 className="font-display text-2xl font-bold">תוכנית דמו</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          בחר אילו מקורות שאלות יהיו זמינים למשתמשי דמו. שינויים מתעדכנים מיד.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {demoUserCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">משתמשי דמו</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {allowedQuestionTotal}
          </div>
          <div className="text-xs text-muted-foreground mt-1">שאלות זמינות לדמו</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{rows.length}</div>
          <div className="text-xs text-muted-foreground mt-1">סה״כ מקורות</div>
        </div>
      </div>

      <DemoPlanClient rows={rows} />
    </div>
  );
}
