import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import {
  resolveReportAction,
  reopenReportAction,
  updateAnswerReportResponseAction,
} from "@/app/admin/reports/actions";
import { AdminNav } from "../AdminNav";
import { ReportStatus } from "@prisma/client";

type SearchParams = { status?: string };

export default async function ReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = (await searchParams) ?? {};
  const view = sp.status === "closed" ? "closed" : "open";

  const where = view === "closed"
    ? { status: { in: [ReportStatus.RESOLVED, ReportStatus.REJECTED] } }
    : { status: ReportStatus.OPEN };

  const [reports, openCount, closedCount] = await Promise.all([
    db.answerReport.findMany({
      where,
      include: {
        question: { include: { geminiAnswer: true, chapter: true } },
        user: { select: { name: true, email: true } },
        resolver: { select: { name: true, email: true } },
      },
      orderBy: { id: "desc" },
      take: view === "closed" ? 100 : undefined,
    }),
    db.answerReport.count({ where: { status: ReportStatus.OPEN } }),
    db.answerReport.count({ where: { status: { in: [ReportStatus.RESOLVED, ReportStatus.REJECTED] } } }),
  ]);

  const tabClass = (active: boolean) =>
    `rounded border px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`;

  return (
    <div className="space-y-4">
      <AdminNav />
      <h1 className="text-2xl font-bold">
        {view === "closed" ? `דיווחים שטופלו ונסגרו (${reports.length})` : `דיווחים פתוחים (${reports.length})`}
      </h1>
      <div className="flex gap-2">
        <Link href="/admin/reports" className={tabClass(view === "open")}>פתוחים ({openCount})</Link>
        <Link href="/admin/reports?status=closed" className={tabClass(view === "closed")}>טופלו ונסגרו ({closedCount})</Link>
      </div>
      {reports.length === 0 && (
        <p className="text-slate-500">{view === "closed" ? "אין דיווחים סגורים." : "אין דיווחים פתוחים."}</p>
      )}
      <ul className="space-y-4">
        {reports.map((r) => {
          const statusLabel =
            r.status === "RESOLVED" ? "טופל" : r.status === "REJECTED" ? "נדחה" : "פתוח";
          const statusClass =
            r.status === "RESOLVED"
              ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200"
              : r.status === "REJECTED"
              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200";
          return (
            <li key={r.id} className="rounded border bg-card text-card-foreground p-4">
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 ${statusClass}`}>{statusLabel}</span>
                <span>
                  דווח על ידי {r.user.name ?? r.user.email} · {r.createdAt.toLocaleString("he-IL")} · פרק {r.question.chapter.number}
                </span>
                {view === "closed" && r.resolver && (
                  <span>· נסגר על ידי {r.resolver.name ?? r.resolver.email}</span>
                )}
              </div>
              <p className="mt-2"><strong>שאלה:</strong> {r.question.stem}</p>
              <p className="mt-1 text-sm"><strong>Gemini אמר:</strong> {r.question.geminiAnswer?.correctAnswer}</p>
              <p className="mt-2 rounded bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-200 p-2 text-sm whitespace-pre-wrap"><strong>הסבר המשתמש:</strong> {r.explanation}</p>

              {view === "open" ? (
                <form action={resolveReportAction} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="block text-xs font-medium text-muted-foreground">
                    תגובה למשתמש (לא חובה — תוצג למשתמש שדיווח)
                  </label>
                  <textarea
                    name="response"
                    rows={3}
                    placeholder="תגובה אופציונלית למשתמש שדיווח (למשל: הסבר תוקן, או הסבר מדוע התשובה נכונה)"
                    className="w-full rounded border bg-background p-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/questions/${r.questionId}`}
                      className="rounded border px-3 py-1 text-sm hover:bg-muted"
                    >
                      פתח שאלה
                    </Link>
                    <button
                      name="status"
                      value="RESOLVED"
                      className="rounded bg-green-600 px-3 py-1 text-sm text-white"
                    >
                      סמן כטופל ושלח תגובה
                    </button>
                    <button
                      name="status"
                      value="REJECTED"
                      className="rounded bg-slate-500 px-3 py-1 text-sm text-white"
                    >
                      דחה
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-3 space-y-2">
                  {r.adminResponse && (
                    <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-sm dark:border-emerald-700 dark:bg-emerald-950/40">
                      <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        תגובת הצוות {r.adminResponseAt && `(${r.adminResponseAt.toLocaleString("he-IL")})`}
                      </div>
                      <p className="whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">{r.adminResponse}</p>
                    </div>
                  )}
                  <form action={updateAnswerReportResponseAction} className="space-y-2">
                    <input type="hidden" name="id" value={r.id} />
                    <textarea
                      name="response"
                      rows={2}
                      defaultValue={r.adminResponse ?? ""}
                      placeholder="ערוך תגובה למשתמש"
                      className="w-full rounded border bg-background p-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/questions/${r.questionId}`}
                        className="rounded border px-3 py-1 text-sm hover:bg-muted"
                      >
                        פתח שאלה
                      </Link>
                      <button className="rounded border bg-card px-3 py-1 text-sm hover:bg-muted">
                        עדכן תגובה
                      </button>
                    </div>
                  </form>
                  <form action={reopenReportAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded border px-3 py-1 text-sm hover:bg-muted">פתח מחדש</button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
