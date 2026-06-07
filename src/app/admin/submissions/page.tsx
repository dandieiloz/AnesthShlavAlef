import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@prisma/client";
import { SubmissionCard, type SubmissionRow } from "./SubmissionsClient";
import type { StandardizedQuestion } from "@/lib/submission-analysis";

const FILTERS = [
  { key: "NEW", label: "חדשות" },
  { key: "ANALYZED", label: "נותחו" },
  { key: "IMPORTED", label: "יובאו" },
  { key: "REJECTED", label: "נדחו" },
  { key: "ALL", label: "הכל" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function isFilterKey(v: string | undefined): v is FilterKey {
  return !!v && FILTERS.some((f) => f.key === v);
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter: FilterKey = isFilterKey(sp.status) ? sp.status : "NEW";

  const where = filter === "ALL" ? {} : { status: filter as SubmissionStatus };
  const [rows, grouped] = await Promise.all([
    db.questionSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { submittedBy: { select: { email: true, name: true, fullName: true } } },
    }),
    db.questionSubmission.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const g of grouped) {
    counts[g.status] = g._count.id;
    total += g._count.id;
  }
  counts.ALL = total;

  const submissions: SubmissionRow[] = rows.map((s) => ({
    id: s.id,
    institute: s.institute,
    year: s.year,
    chapterHint: s.chapterHint,
    doctorName: s.doctorName,
    submitterLabel: s.submittedBy
      ? s.submittedBy.fullName || s.submittedBy.name || s.submittedBy.email || "משתמש מחובר"
      : "אנונימי",
    content: s.rawText ?? s.extractedText ?? "",
    fileName: s.fileName,
    status: s.status,
    analysis: (s.analysis as unknown as StandardizedQuestion[] | null) ?? null,
    importedCount: s.importedCount,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <AdminNav />

      <div>
        <h1 className="text-2xl font-bold">שאלות שנשלחו</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          שאלות שמשתמשים שלחו דרך{" "}
          <Link href="/contribute" className="text-primary hover:underline">
            עמוד התרומה
          </Link>
          . נתחו אותן עם Gemini והוסיפו למרכז התור.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/submissions?status=${f.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {f.label}
            {counts[f.key] ? <span className="ms-1.5 text-xs opacity-80">{counts[f.key]}</span> : null}
          </Link>
        ))}
      </nav>

      {submissions.length === 0 ? (
        <p className="rounded border bg-card p-8 text-center text-sm text-muted-foreground">
          אין שליחות בקטגוריה זו
        </p>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} />
          ))}
        </div>
      )}
    </div>
  );
}
