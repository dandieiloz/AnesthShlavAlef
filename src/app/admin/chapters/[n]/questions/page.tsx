import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { saveQuestionAction } from "@/app/admin/actions";

export default async function ChapterQuestions({ params }: { params: Promise<{ n: string }> }) {
  await requireAdmin();
  const { n } = await params;
  const chapter = await db.chapter.findUnique({
    where: { number: Number(n) },
  });
  if (!chapter) notFound();
  // v2: include questions whose evidence (chapterIds[]) touches this chapter,
  // not just those whose primary chapterId equals it.
  const questions = await db.question.findMany({
    where: { chapterIds: { has: chapter.id } },
    include: { geminiAnswer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <Link href="/admin" className="text-sm text-primary hover:underline">← חזרה לפרקים</Link>
      <h1 className="text-2xl font-bold mt-2">פרק {chapter.number}: {chapter.title}</h1>
      {!chapter.ingestedAt && (
        <p className="mt-2 rounded bg-yellow-100 dark:bg-yellow-900/30 p-2 text-sm text-yellow-800 dark:text-yellow-200">⚠ הפרק עדיין לא נטען. הריצו את סקריפט הקליטה לפני יצירת הסברים.</p>
      )}

      <h2 className="mt-6 text-lg font-semibold">שאלות קיימות ({questions.length})</h2>
      <ul className="mt-2 space-y-2">
        {questions.map((q) => (
          <li key={q.id} className="rounded border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/admin/questions/${q.id}`} className="flex-1 hover:underline">{q.stem.slice(0, 140)}</Link>
              <div className="flex flex-col items-end gap-1">
                {q.chapterId !== chapter.id && (
                  <span className="text-xs rounded bg-muted px-2 py-0.5 text-muted-foreground" title="פרק ראשי שונה">
                    ראשי: פרק {q.chapterId}
                  </span>
                )}
                <span className={`text-xs rounded px-2 py-1 ${q.geminiAnswer ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
                  {q.geminiAnswer ? "יש הסבר" : "ללא הסבר"}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold">שאלה חדשה</h2>
      <form action={saveQuestionAction} className="mt-2 space-y-2 rounded border bg-card p-4">
        <input type="hidden" name="chapterNumber" value={chapter.number} />
        <textarea name="stem" placeholder="גוף השאלה" required rows={3} className="w-full rounded border p-2 bg-background text-foreground placeholder:text-muted-foreground" />
        <input name="optionA" placeholder="א." required className="w-full rounded border p-2 bg-background text-foreground placeholder:text-muted-foreground" />
        <input name="optionB" placeholder="ב." required className="w-full rounded border p-2 bg-background text-foreground placeholder:text-muted-foreground" />
        <input name="optionC" placeholder="ג." required className="w-full rounded border p-2 bg-background text-foreground placeholder:text-muted-foreground" />
        <input name="optionD" placeholder="ד." required className="w-full rounded border p-2 bg-background text-foreground placeholder:text-muted-foreground" />
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">תשובה נכונה:</label>
          <select name="correctAnswer" className="rounded border p-1 text-sm bg-background text-foreground">
            <option value="">— לא הוגדר —</option>
            <option value="A">א</option>
            <option value="B">ב</option>
            <option value="C">ג</option>
            <option value="D">ד</option>
          </select>
        </div>
        <button className="rounded bg-slate-900 px-4 py-2 text-white">הוסף שאלה</button>
      </form>
    </div>
  );
}
