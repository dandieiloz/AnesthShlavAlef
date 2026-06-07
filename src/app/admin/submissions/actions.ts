"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { standardizeSubmission, type StandardizedQuestion } from "@/lib/submission-analysis";

export type AnalyzeResult =
  | { ok: true; questions: StandardizedQuestion[] }
  | { ok: false; error: string };

export type ImportResult =
  | { ok: true; saved: number; skipped: number }
  | { ok: false; error: string };

export type RejectResult = { ok: true } | { ok: false; error: string };

/** Strip whitespace and common punctuation for loose duplicate comparison (mirrors the wizard). */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s.,\-/'“”‘’?!:;()[\]{}<>|\\@#$%^&*+=~–—]/g, "");
}

const ANSWER_LABEL: Record<"A" | "B" | "C" | "D", string> = { A: "א", B: "ב", C: "ג", D: "ד" };

// ─── Run the Gemini standardization pass on a raw submission ─────────────────

export async function analyzeSubmissionAction(id: string): Promise<AnalyzeResult> {
  await requireAdmin();
  const submission = await db.questionSubmission.findUnique({ where: { id } });
  if (!submission) return { ok: false, error: "השליחה לא נמצאה" };

  const text = (submission.rawText ?? submission.extractedText ?? "").trim();
  if (text.length < 20) return { ok: false, error: "אין מספיק טקסט לניתוח" };

  try {
    const questions = await standardizeSubmission(text);
    if (questions.length === 0) return { ok: false, error: "לא זוהו שאלות בטקסט" };
    await db.questionSubmission.update({
      where: { id },
      data: {
        analysis: questions as unknown as Prisma.InputJsonValue,
        status: "ANALYZED",
        analyzedAt: new Date(),
      },
    });
    revalidatePath("/admin/submissions");
    return { ok: true, questions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Import selected standardized questions into the generation queue ────────

export async function importSubmissionAction(id: string, selectedIndexes: number[]): Promise<ImportResult> {
  const me = await requireAdmin();
  const submission = await db.questionSubmission.findUnique({ where: { id } });
  if (!submission) return { ok: false, error: "השליחה לא נמצאה" };

  const analysis = (submission.analysis as unknown as StandardizedQuestion[] | null) ?? null;
  if (!analysis || analysis.length === 0) return { ok: false, error: "יש לנתח את השליחה תחילה" };

  const selectedSet = new Set(selectedIndexes);
  const chosen = analysis.filter((_, i) => selectedSet.has(i));
  if (chosen.length === 0) return { ok: false, error: "לא נבחרו שאלות לייבוא" };

  // Source mirrors the wizard convention: "<institute> <year>".
  const source = submission.year ? `${submission.institute} ${submission.year}` : submission.institute;

  // Placeholder chapter — the RAG pipeline overwrites chapterId/chapterIds from evidence.
  const defaultChapter = await db.chapter.findFirst({ orderBy: { number: "asc" } });
  if (!defaultChapter) return { ok: false, error: "אין פרקים במסד הנתונים — הריצו db:seed" };

  const existing = await db.question.findMany({ select: { stem: true } });
  const existingNorms = new Set(existing.map((q) => normalize(q.stem)));

  let saved = 0;
  let skipped = 0;

  for (const q of chosen) {
    if (!q.stem || !q.optionA || !q.optionB || !q.optionC || !q.optionD) {
      skipped++;
      continue;
    }
    const norm = normalize(q.stem);
    if (existingNorms.has(norm)) {
      skipped++;
      continue;
    }

    const created = await db.question.create({
      data: {
        chapterId: defaultChapter.id,
        chapterIds: [defaultChapter.id],
        stem: q.stem,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: null, // authoritative answer is determined by the RAG pipeline
        source,
        createdById: me.id,
      },
    });

    // Enqueue an INITIAL generation job — same path as the admin question wizard.
    await db.answerGenerationJob.create({
      data: { questionId: created.id, kind: "INITIAL", createdById: me.id },
    });

    // Persist the submitter-provided context (incl. their claimed answer) as an admin-only hint.
    const noteBody = [
      `יובא מתרומת משתמש (submission ${submission.id}).`,
      `מוסד: ${submission.institute}${submission.year ? `, שנה: ${submission.year}` : ""}` +
        `${submission.chapterHint ? `, פרק/נושא: ${submission.chapterHint}` : ""}` +
        `${submission.doctorName ? `, רופא/ה: ${submission.doctorName}` : ""}.`,
      `תשובה שסומנה ע״י השולח: ${q.submitterAnswer ? ANSWER_LABEL[q.submitterAnswer] : "לא צוינה"} ` +
        `(רמז בלבד — התשובה הסופית נקבעת ע״י המנוע).`,
    ].join("\n");
    await db.questionAdminNote.create({
      data: { questionId: created.id, authorId: me.id, body: noteBody },
    });

    existingNorms.add(norm);
    saved++;
  }

  await db.questionSubmission.update({
    where: { id },
    data: { status: "IMPORTED", importedCount: saved, reviewedById: me.id, reviewedAt: new Date() },
  });

  revalidatePath("/admin/submissions");
  revalidatePath("/admin/queue");
  return { ok: true, saved, skipped };
}

// ─── Reject a submission ─────────────────────────────────────────────────────

export async function rejectSubmissionAction(id: string): Promise<RejectResult> {
  const me = await requireAdmin();
  const submission = await db.questionSubmission.findUnique({ where: { id }, select: { id: true } });
  if (!submission) return { ok: false, error: "השליחה לא נמצאה" };
  await db.questionSubmission.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: me.id, reviewedAt: new Date() },
  });
  revalidatePath("/admin/submissions");
  return { ok: true };
}
