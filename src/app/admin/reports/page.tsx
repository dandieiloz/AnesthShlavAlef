import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { resolveReportAction } from "@/app/admin/reports/actions";
import { AdminNav } from "../AdminNav";

export default async function ReportsPage() {
  await requireAdmin();
  const reports = await db.answerReport.findMany({
    where: { status: "OPEN" },
    include: {
      question: { include: { geminiAnswer: true, chapter: true } },
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <AdminNav />
      <h1 className="text-2xl font-bold">דיווחים על תשובות שגויות ({reports.length})</h1>
      {reports.length === 0 && <p className="text-slate-500">אין דיווחים פתוחים.</p>}
      <ul className="space-y-4">
        {reports.map((r) => (
          <li key={r.id} className="rounded border bg-card text-card-foreground p-4">
            <div className="text-xs text-muted-foreground">
              דווח על ידי {r.user.name ?? r.user.email} · {r.createdAt.toLocaleString("he-IL")} · פרק {r.question.chapter.number}
            </div>
            <p className="mt-2"><strong>שאלה:</strong> {r.question.stem}</p>
            <p className="mt-1 text-sm"><strong>Gemini אמר:</strong> {r.question.geminiAnswer?.correctAnswer}</p>
            <p className="mt-2 rounded bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-200 p-2 text-sm whitespace-pre-wrap"><strong>הסבר המשתמש:</strong> {r.explanation}</p>
            <div className="mt-3 flex gap-2">
              <Link href={`/admin/questions/${r.questionId}`} className="rounded border px-3 py-1 text-sm hover:bg-muted">פתח שאלה</Link>
              <form action={async () => { "use server"; await resolveReportAction(r.id, "RESOLVED"); }}>
                <button className="rounded bg-green-600 px-3 py-1 text-sm text-white">סמן כטופל</button>
              </form>
              <form action={async () => { "use server"; await resolveReportAction(r.id, "REJECTED"); }}>
                <button className="rounded bg-slate-500 px-3 py-1 text-sm text-white">דחה</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
