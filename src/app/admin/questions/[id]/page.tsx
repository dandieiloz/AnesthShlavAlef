import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import {
  saveQuestionAction,
  deleteQuestionAction,
  updateQuestionChaptersAction,
  resetChapterAutoTagAction,
  addAdminNoteAction,
  deleteAdminNoteAction,
} from "@/app/admin/actions";
import {
  enqueueInitialJobAction,
  enqueueRegenerationAction,
} from "@/app/admin/queue/actions";
import { deleteCommentAction, postCommentAction } from "@/app/(user)/actions";
import { DeleteQuestionButton } from "./DeleteQuestionButton";
import { DisableQuestionButton } from "./DisableQuestionButton";
import { ApproveQuestionButton } from "./ApproveQuestionButton";
import { EditableGeminiAnswer } from "./EditableGeminiAnswer";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { QuestionImage } from "@/components/QuestionImage";
import { QuestionVideo } from "@/components/QuestionVideo";
import { updateQuestionImageAction, updateQuestionVideoAction } from "@/app/admin/new-question/actions";
import { getPublishConfidenceThreshold } from "@/lib/publish-threshold";

export default async function AdminQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const q = await db.question.findUnique({
    where: { id: Number(id) },
    include: { chapter: true, geminiAnswer: true },
  });
  if (!q) notFound();

  // Check for an open generation job
  const openJob = await db.answerGenerationJob.findFirst({
    where: { questionId: q.id, status: { in: ["PENDING", "PROCESSING"] } },
    select: { id: true, status: true, kind: true },
  });

  // Pending regeneration candidate awaiting admin review
  const pendingCandidate = await db.geminiAnswerCandidate.findUnique({
    where: { questionId: q.id },
    select: { generatedAt: true, correctAnswer: true, confidence: true },
  });

  // Load metadata for chapters this question is tagged with (so we can display titles)
  const taggedChapters = await db.chapter.findMany({
    where: { id: { in: q.chapterIds.length > 0 ? q.chapterIds : [q.chapterId] } },
    select: { id: true, number: true, title: true },
    orderBy: { number: "asc" },
  });
  const allChapters = await db.chapter.findMany({
    select: { number: true, title: true },
    orderBy: { number: "asc" },
  });

  const adminNotes = await db.questionAdminNote.findMany({
    where: { questionId: q.id },
    include: { author: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const comments = await db.comment.findMany({
    where: { questionId: q.id },
    include: { user: { select: { name: true, email: true, hospitalName: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Per-question attempt stats
  const [attemptTotal, attemptCorrect, uniqueUsersGroup] = await Promise.all([
    db.attempt.count({ where: { questionId: q.id } }),
    db.attempt.count({ where: { questionId: q.id, isCorrect: true } }),
    db.attempt.groupBy({ by: ["userId"], where: { questionId: q.id } }),
  ]);
  const uniqueUsers = uniqueUsersGroup.length;
  const percentCorrect =
    attemptTotal === 0 ? null : Math.round((attemptCorrect / attemptTotal) * 100);

  const publishThreshold = await getPublishConfidenceThreshold();
  const answerConfidence = q.geminiAnswer?.confidence ?? null;
  const meetsThreshold = answerConfidence !== null && answerConfidence >= publishThreshold;
  // Show the approve toggle only when manual approval matters: either the answer is
  // below threshold (and admin can publish it), or it is already manually approved (so
  // admin can revoke). If the answer already meets the threshold, the button is hidden.
  const showApproveButton = q.adminApproved || !meetsThreshold;

  return (
    <div>
      <Link href={`/admin/chapters/${q.chapter.number}/questions`} className="text-sm text-primary hover:underline">
        ← פרק {q.chapter.number}
      </Link>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">שאלה #{q.id}</h1>
          <Link
            href={`/history/${q.id}`}
            target="_blank"
            className="text-sm text-primary hover:underline"
          >
            צפייה בעמוד השאלה ↗
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {q.disabled ? (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              מושבתת
            </span>
          ) : null}
          {q.adminApproved ? (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              מאושרת ידנית
            </span>
          ) : null}
          {q.acceptedAnswers.length > 0 ? (
            <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200" title={`תשובות מתקבלות נוספות: ${q.acceptedAnswers.join(", ")}`}>
              תשובות מרובות
            </span>
          ) : null}
          {showApproveButton && (
            <ApproveQuestionButton
              questionId={q.id}
              approved={q.adminApproved}
              insufficientEvidence={q.geminiAnswer?.insufficientEvidence ?? false}
            />
          )}
          <DisableQuestionButton questionId={q.id} disabled={q.disabled} />
          <DeleteQuestionButton questionId={q.id} chapterNumber={q.chapter.number} />
        </div>
      </div>
      {error && (
        <div className="mt-2 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300">
          חולל הסבר נכשל: {error === "chapter-not-ingested" ? "הפרק עוד לא נטען עם תוכן" : decodeURIComponent(error)}
        </div>
      )}

      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{attemptTotal}</div>
          <div className="text-xs text-muted-foreground mt-1">סה״כ ניסיונות</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{uniqueUsers}</div>
          <div className="text-xs text-muted-foreground mt-1">משתמשים ייחודיים</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {attemptCorrect}
          </div>
          <div className="text-xs text-muted-foreground mt-1">תשובות נכונות</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div
            className={`text-2xl font-bold font-mono ${
              percentCorrect === null
                ? ""
                : percentCorrect >= 70
                  ? "text-emerald-600 dark:text-emerald-400"
                  : percentCorrect >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
            }`}
          >
            {percentCorrect === null ? "—" : `${percentCorrect}%`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">אחוז הצלחה</div>
        </div>
      </div>

      <form action={saveQuestionAction} className="mt-4 space-y-2 rounded border bg-card p-4">
        <input type="hidden" name="id" value={q.id} />
        <input type="hidden" name="chapterNumber" value={q.chapter.number} />
        <textarea name="stem" defaultValue={q.stem} rows={3} className="w-full rounded border p-2 bg-background text-foreground" />
        <input name="optionA" defaultValue={q.optionA} className="w-full rounded border p-2 bg-background text-foreground" />
        <input name="optionB" defaultValue={q.optionB} className="w-full rounded border p-2 bg-background text-foreground" />
        <input name="optionC" defaultValue={q.optionC} className="w-full rounded border p-2 bg-background text-foreground" />
        <input name="optionD" defaultValue={q.optionD} className="w-full rounded border p-2 bg-background text-foreground" />
        {(() => {
          const m = (q.source ?? "").match(/^(.+?)\s+(\d{4})(?:\s+(.+))?$/);
          const defInstitution = m ? m[1] : "";
          const defYear = m ? m[2] : "";
          const defGroup = m ? (m[3] ?? "") : "";
          return (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
                <SearchableSelect
                  name="sourceInstitution"
                  defaultValue={defInstitution}
                  options={QUESTION_SOURCES}
                  clearable
                  clearLabel="— ללא מוסד —"
                  placeholder="— ללא מוסד —"
                  searchPlaceholder="חיפוש מוסד..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
                <input
                  type="number"
                  name="sourceYear"
                  min={1990}
                  max={2030}
                  defaultValue={defYear}
                  className="w-24 rounded border p-1 text-sm bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">קבוצה (אופציונלי)</label>
                <input
                  type="text"
                  name="sourceGroup"
                  defaultValue={defGroup}
                  placeholder="לדוגמה: א, ב, מועד א"
                  className="w-32 rounded border p-1 text-sm bg-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          );
        })()}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">תשובה נכונה:</label>
          <select name="correctAnswer" defaultValue={q.correctAnswer ?? q.geminiAnswer?.correctAnswer ?? ""} className="rounded border p-1 text-sm bg-background text-foreground">
            <option value="">— לא הוגדר —</option>
            <option value="A">א</option>
            <option value="B">ב</option>
            <option value="C">ג</option>
            <option value="D">ד</option>
          </select>
        </div>
        {(() => {
          const primary = q.correctAnswer ?? q.geminiAnswer?.correctAnswer ?? null;
          const accepted = new Set(q.acceptedAnswers);
          const HEB: Record<"A" | "B" | "C" | "D", string> = { A: "א", B: "ב", C: "ג", D: "ד" };
          return (
            <fieldset className="flex flex-wrap items-center gap-3 rounded border border-dashed p-2">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                תשובות נוספות שמתקבלות (לשאלות עם יותר מתשובה אחת נכונה)
              </legend>
              {(["A", "B", "C", "D"] as const).map((c) => {
                const isPrimary = primary === c;
                return (
                  <label
                    key={c}
                    className={`flex items-center gap-1.5 text-sm ${isPrimary ? "opacity-50" : ""}`}
                    title={isPrimary ? "זוהי התשובה הנכונה הראשית" : undefined}
                  >
                    <input
                      type="checkbox"
                      name="acceptedAnswers"
                      value={c}
                      defaultChecked={accepted.has(c)}
                      disabled={isPrimary}
                    />
                    <span>{HEB[c]}</span>
                  </label>
                );
              })}
            </fieldset>
          );
        })()}
        <button className="rounded bg-slate-900 px-4 py-2 text-white">שמור</button>
      </form>

      <section className="mt-4 rounded border bg-card p-4">
        <h2 className="text-base font-semibold">תמונה מצורפת</h2>
        {q.imageUrl ? (
          <div className="mt-2">
            <QuestionImage url={q.imageUrl} alt={q.imageAlt} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">אין תמונה מצורפת.</p>
        )}
        <form action={updateQuestionImageAction} className="mt-3 space-y-2">
          <input type="hidden" name="questionId" value={q.id} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {q.imageUrl ? "החלף תמונה" : "העלה תמונה"}
            </label>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="block text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">PNG / JPEG / WebP / GIF · עד 5MB</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">טקסט חלופי (alt)</label>
            <input
              type="text"
              name="imageAlt"
              defaultValue={q.imageAlt ?? ""}
              className="w-full rounded border p-1.5 text-sm bg-background text-foreground"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              שמור
            </button>
            {q.imageUrl && (
              <button
                type="submit"
                name="intent"
                value="remove"
                className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                הסר תמונה
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-4 rounded border bg-card p-4">
        <h2 className="text-base font-semibold">סרטון מצורף</h2>
        {q.videoUrl ? (
          <div className="mt-2">
            <QuestionVideo url={q.videoUrl} />
            <p className="mt-1 text-[11px] text-muted-foreground break-all" dir="ltr">{q.videoUrl}</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">אין סרטון מצורף.</p>
        )}
        <form action={updateQuestionVideoAction} className="mt-3 space-y-2">
          <input type="hidden" name="questionId" value={q.id} />
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">קישור וידאו</label>
            <input
              type="url"
              name="videoUrl"
              defaultValue={q.videoUrl ?? ""}
              placeholder="https://www.youtube.com/watch?v=... או https://vimeo.com/... או קובץ .mp4"
              className="w-full rounded border p-1.5 text-sm bg-background text-foreground placeholder:text-muted-foreground"
              dir="ltr"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">YouTube, Vimeo, או קובץ mp4/webm. הסרטון יתנגן אוטומטית (מושתק).</p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              name="intent"
              value="save"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
            >
              שמור
            </button>
            {q.videoUrl && (
              <button
                type="submit"
                name="intent"
                value="remove"
                className="rounded border border-destructive px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
              >
                הסר סרטון
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">הסבר Gemini (מטמון)</h2>
        {q.geminiAnswer ? (
          <>
            <p className="text-xs text-muted-foreground mt-1">
              נוצר {q.geminiAnswer.generatedAt.toLocaleString("he-IL")} · מודל: {q.geminiAnswer.model} · תשובה: {q.geminiAnswer.correctAnswer}
              {typeof q.geminiAnswer.confidence === "number" && (
                <span> · ביטחון: {(q.geminiAnswer.confidence * 100).toFixed(0)}%</span>
              )}
              {q.geminiAnswer.escalated && (
                <span className="mr-1 rounded bg-amber-100 dark:bg-amber-900/30 px-1 text-amber-800 dark:text-amber-300"> Escalated</span>
              )}
              {q.geminiAnswer.insufficientEvidence && (
                <span className="mr-1 rounded bg-red-100 dark:bg-red-900/30 px-1 text-red-800 dark:text-red-300"> Insufficient evidence</span>
              )}
              {q.geminiAnswer.sourceChapters.length > 0 && (
                <span> · פרקים שנסרקו: {q.geminiAnswer.sourceChapters.join(", ")}</span>
              )}
            </p>
            <div className="mt-3">
              <EditableGeminiAnswer
                questionId={q.id}
                explanation={q.geminiAnswer.explanation}
                whyOthersWrong={q.geminiAnswer.whyOthersWrong}
                evidenceCitations={(q.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null) ?? []}
                correctAnswer={q.geminiAnswer.correctAnswer}
                options={[
                  { key: "A", text: q.optionA },
                  { key: "B", text: q.optionB },
                  { key: "C", text: q.optionC },
                  { key: "D", text: q.optionD },
                ]}
                insufficientEvidence={q.geminiAnswer.insufficientEvidence}
                defaultChapterNumber={q.chapter.number}
              />
            </div>
            <form
              action={async (formData: FormData) => {
                "use server";
                const hint = String(formData.get("hint") ?? "");
                await enqueueRegenerationAction(q.id, hint);
              }}
              className="mt-2 space-y-2"
            >
              {!openJob && !pendingCandidate && (
                <details className="rounded border bg-muted/30 px-3 py-2 text-sm">
                  <summary className="cursor-pointer text-primary hover:underline">
                    הוסף הערה / רמז למודל (אופציונלי)
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">
                    הסבר בקצרה למה ההסבר הקיים שגוי כדי לעזור למודל לחולל תשובה טובה יותר. לדוגמה:
                    "התשובה הנכונה היא B כי...", "המודל התעלם מהשפעת...", "המקור הנכון נמצא בפרק X".
                    הראיות עדיין חייבות להגיע מקטעי המקור.
                  </p>
                  <textarea
                    name="hint"
                    rows={4}
                    maxLength={2000}
                    className="mt-2 w-full rounded border p-2 text-sm bg-background text-foreground"
                    placeholder="הערה למודל (עד 2000 תווים)..."
                  />
                </details>
              )}
              <button
                disabled={!!pendingCandidate}
                className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pendingCandidate
                  ? "מועמד ממתין לאישור"
                  : openJob
                  ? "✓ ממתין בתור"
                  : "חולל מחדש (+ לתור)"}
              </button>
              {openJob && (
                <Link
                  href="/admin/queue"
                  className="ml-2 inline-block rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                >
                  מעבר למרכז התור →
                </Link>
              )}
            </form>
            {pendingCandidate && (
              <div className="mt-3 rounded border-2 border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  חילול חדש ממתין לאישור
                </div>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  נוצר {new Date(pendingCandidate.generatedAt).toLocaleString("he-IL")} · תשובה
                  מוצעת: {pendingCandidate.correctAnswer}
                  {pendingCandidate.confidence !== null
                    ? ` (${Math.round(pendingCandidate.confidence * 100)}%)`
                    : ""}
                </p>
                <Link
                  href={`/admin/candidates#q-${q.id}`}
                  className="mt-2 inline-block rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
                >
                  השווה ובחר
                </Link>
              </div>
            )}
          </>
        ) : (
          <form action={async () => { "use server"; await enqueueInitialJobAction(q.id); }} className="mt-2">
            <button className="rounded bg-blue-600 px-4 py-2 text-white">
              {openJob ? "✓ ממתין בתור לחילול" : "הוסף לתור לחילול"}
            </button>
          </form>
        )}
      </section>

      <section className="mt-8 rounded border bg-card p-4">
        <h2 className="text-base font-semibold">סיווג פרקים</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {q.chapterAutoTagged ? (
            <>
              סיווג אוטומטי מתוך הראיות שהציג המודל. יתעדכן בכל חילול הסבר חדש.
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">סיווג ידני — לא ישתנה בחילולים אוטומטיים.</span>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {taggedChapters.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                c.id === q.chapterId ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted text-muted-foreground"
              }`}
              title={c.title}
            >
              {c.id === q.chapterId && <span aria-label="ראשי">★</span>}
              פרק {c.number}: {c.title}
            </span>
          ))}
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary hover:underline">עריכת סיווג ידנית</summary>
          <form action={updateQuestionChaptersAction} className="mt-3 space-y-2 text-sm">
            <input type="hidden" name="questionId" value={q.id} />
            <div>
              <label className="block text-xs font-medium">פרקים משוייכים (מופרדים בפסיקים)</label>
              <input
                type="text"
                name="chapterNumbers"
                defaultValue={taggedChapters.map((c) => c.number).join(",")}
                placeholder="למשל: 24,15,11"
                className="mt-1 w-full rounded border p-1 font-mono text-sm bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">פרק ראשי</label>
              <select
                name="primaryChapterNumber"
                defaultValue={q.chapter.number}
                className="mt-1 rounded border p-1 bg-background text-foreground"
              >
                {allChapters.map((c) => (
                  <option key={c.number} value={c.number}>
                    פרק {c.number}: {c.title}
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">שמור סיווג</button>
          </form>
          {!q.chapterAutoTagged && (
            <form action={async () => { "use server"; await resetChapterAutoTagAction(q.id); }} className="mt-2">
              <button className="text-xs text-primary hover:underline">
                החזר לסיווג אוטומטי (ידרוס בחילול הבא)
              </button>
            </form>
          )}
        </details>
      </section>

      <section className="mt-8 rounded border bg-card p-4">
        <h2 className="text-base font-semibold">תגובות קהילה ({comments.length})</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          תגובות שמשתמשים פרסמו על השאלה במסך הסבר התשובה.
        </p>
        <form action={postCommentAction} className="mt-3 space-y-2">
          <input type="hidden" name="questionId" value={q.id} />
          <textarea
            name="body"
            required
            rows={3}
            maxLength={2000}
            placeholder="כתוב תגובה כמנהל..."
            className="w-full rounded border p-2 text-sm bg-background text-foreground"
            dir="rtl"
          />
          <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">פרסם תגובה</button>
        </form>
        <ul className="mt-4 space-y-2">
          {comments.length === 0 && (
            <li className="text-xs text-muted-foreground">אין תגובות.</li>
          )}
          {comments.map((c) => (
            <li key={c.id} className="rounded border bg-background/60 p-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {c.user?.name ?? c.user?.email ?? "לא ידוע"}
                  {c.user?.hospitalName ? ` · ${c.user.hospitalName}` : ""}
                  {" · "}
                  {c.createdAt.toLocaleString("he-IL")}
                  {c.editedAt ? " · נערך" : ""}
                </span>
                <form action={deleteCommentAction}>
                  <input type="hidden" name="commentId" value={c.id} />
                  <button className="text-red-700 hover:underline">מחק</button>
                </form>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm" dir="rtl">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded border bg-card p-4">
        <h2 className="text-base font-semibold">הערות מנהל (פנימי)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          הערות אלו גלויות רק למנהלים. שימושי לתיעוד שינויים, החלטות עריכה, וכד׳.
        </p>
        <form action={addAdminNoteAction} className="mt-3 space-y-2">
          <input type="hidden" name="questionId" value={q.id} />
          <textarea
            name="body"
            required
            rows={3}
            placeholder="כתוב הערה..."
            className="w-full rounded border p-2 text-sm bg-background text-foreground"
            dir="rtl"
          />
          <button className="rounded bg-slate-900 px-3 py-1 text-xs text-white">הוסף הערה</button>
        </form>
        <ul className="mt-4 space-y-2">
          {adminNotes.length === 0 && (
            <li className="text-xs text-muted-foreground">אין הערות.</li>
          )}
          {adminNotes.map((n) => (
            <li key={n.id} className="rounded border bg-background/60 p-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {n.author?.name ?? n.author?.email ?? "לא ידוע"} ·{" "}
                  {n.createdAt.toLocaleString("he-IL")}
                </span>
                <form action={deleteAdminNoteAction}>
                  <input type="hidden" name="noteId" value={n.id} />
                  <button className="text-red-700 hover:underline">מחק</button>
                </form>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm" dir="rtl">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
