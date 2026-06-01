import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import { resolveDebugReportAction } from "./actions";
import type { ReportStatus } from "@prisma/client";

const STATUS_TABS: Array<{ value: ReportStatus; label: string }> = [
  { value: "OPEN", label: "פתוחים" },
  { value: "RESOLVED", label: "טופלו" },
  { value: "REJECTED", label: "נדחו" },
];

const KIND_LABEL: Record<string, string> = {
  BUG: "באג",
  FEEDBACK: "משוב",
  TECHNICAL: "טכני",
};

const KIND_BADGE: Record<string, string> = {
  BUG: "bg-red-100 text-red-700",
  FEEDBACK: "bg-blue-100 text-blue-700",
  TECHNICAL: "bg-amber-100 text-amber-700",
};

export default async function DebugReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (STATUS_TABS.find((t) => t.value === sp.status)?.value ?? "OPEN") as ReportStatus;

  const reports = await db.debugReport.findMany({
    where: { status },
    include: {
      user: { select: { name: true, email: true } },
      question: { select: { id: true, stem: true, chapterId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">דיווחי באג ומשוב ({reports.length})</h1>
        <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1 text-sm">
          {STATUS_TABS.map((t) => {
            const active = t.value === status;
            return (
              <Link
                key={t.value}
                href={`/admin/debug-reports?status=${t.value}`}
                className={`rounded-md px-3 py-1 transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {reports.length === 0 && (
        <p className="text-slate-500">אין דיווחים בקטגוריה זו.</p>
      )}

      <ul className="space-y-4">
        {reports.map((r) => (
          <li key={r.id} className="rounded border bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE[r.kind]}`}>
                {KIND_LABEL[r.kind] ?? r.kind}
              </span>
              {r.category && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{r.category}</span>
              )}
              <span>·</span>
              <span>{r.user.name ?? r.user.email}</span>
              <span>·</span>
              <span>{r.createdAt.toLocaleString("he-IL")}</span>
              {r.chapterNumber && (
                <>
                  <span>·</span>
                  <span>פרק {r.chapterNumber}</span>
                </>
              )}
            </div>

            <p className="whitespace-pre-wrap text-sm">{r.description}</p>

            <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
              {r.contactEmail && (
                <div>
                  <strong>צור קשר:</strong>{" "}
                  <a href={`mailto:${r.contactEmail}`} className="text-blue-600 hover:underline">
                    {r.contactEmail}
                  </a>
                </div>
              )}
              {r.pageUrl && (
                <div className="truncate">
                  <strong>דף:</strong>{" "}
                  <a
                    href={r.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {r.pageUrl}
                  </a>
                </div>
              )}
              {r.questionId && r.question && (
                <div>
                  <strong>שאלה:</strong>{" "}
                  <Link
                    href={`/admin/questions/${r.questionId}`}
                    className="text-blue-600 hover:underline"
                  >
                    #{r.questionId}
                  </Link>
                </div>
              )}
            </div>

            {status === "OPEN" && (
              <div className="flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await resolveDebugReportAction(r.id, "RESOLVED");
                  }}
                >
                  <button className="rounded bg-green-600 px-3 py-1 text-sm text-white">
                    סמן כטופל
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await resolveDebugReportAction(r.id, "REJECTED");
                  }}
                >
                  <button className="rounded bg-slate-500 px-3 py-1 text-sm text-white">
                    דחה
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
