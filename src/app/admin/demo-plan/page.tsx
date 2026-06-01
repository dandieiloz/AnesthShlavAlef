import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { QUESTION_SOURCES } from "@/lib/hospitals";
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
  const nullSourceAllowed = allowedSet.has(NULL_SOURCE_SENTINEL);

  const countMap = new Map<string, number>();
  for (const r of sourceCounts) {
    if (r.source) countMap.set(r.source, r._count._all);
  }

  // Canonical sources from QUESTION_SOURCES, plus any DB sources that don't match the canonical list (legacy / "Institution YYYY").
  const canonicalSet = new Set<string>(QUESTION_SOURCES);
  const extraDbSources = [...countMap.keys()].filter((s) => !canonicalSet.has(s)).sort();

  const rows: SourceRow[] = [
    ...QUESTION_SOURCES.map((s) => ({
      source: s,
      allowed: allowedSet.has(s),
      questionCount: countMap.get(s) ?? 0,
    })),
    ...extraDbSources.map((s) => ({
      source: s,
      allowed: allowedSet.has(s),
      questionCount: countMap.get(s) ?? 0,
    })),
  ];

  const allowedQuestionTotal =
    rows.filter((r) => r.allowed).reduce((sum, r) => sum + r.questionCount, 0) +
    (nullSourceAllowed ? nullSourceCount : 0);

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

      <DemoPlanClient
        rows={rows}
        nullSourceAllowed={nullSourceAllowed}
        nullSourceQuestionCount={nullSourceCount}
      />
    </div>
  );
}
