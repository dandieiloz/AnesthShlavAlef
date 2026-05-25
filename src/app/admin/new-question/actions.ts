"use server";
import { requireAdmin } from "@/lib/auth";
import { parseQuestion, parseMultipleQuestions, type ParsedQuestion } from "@/lib/wizard";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export type WizardParseResult =
  | { ok: true; parsed: ParsedQuestion }
  | { ok: false; error: string };

export type WizardMultiParseResult =
  | { ok: true; parsed: ParsedQuestion[] }
  | { ok: false; error: string };

export type QueueItem = ParsedQuestion & {
  correctAnswer: "A" | "B" | "C" | "D" | null;
  source: string | null;
};

export type SaveMultipleResult = {
  saved: Array<{ id: number; stem: string }>;
  skipped: Array<{ stem: string; existingId: number }>;
  errors: string[];
};

/** Strip whitespace and common punctuation for loose equality comparison. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s.,\-/'“”‘’?!:;()[\]{}<>|\\@#$%^&*+=~–—]/g, "");
}

export async function saveMultipleQuestionsAction(items: QueueItem[]): Promise<SaveMultipleResult> {
  const me = await requireAdmin();
  const saved: Array<{ id: number; stem: string }> = [];
  const skipped: Array<{ stem: string; existingId: number }> = [];
  const errors: string[] = [];

  // Fetch all existing stems once — used for duplicate detection across the whole batch
  const existingQuestions = await db.question.findMany({ select: { id: true, stem: true } });
  const existingNormed = existingQuestions.map((q) => ({ id: q.id, stem: q.stem, norm: normalize(q.stem) }));

  // Fetch a placeholder chapter (RAG will overwrite chapterId/chapterIds from evidence)
  const defaultChapter = await db.chapter.findFirst({ orderBy: { number: "asc" } });
  if (!defaultChapter) throw new Error("No chapters in DB — run db:seed first");

  for (const item of items) {
    try {
      const { stem, optionA, optionB, optionC, optionD, correctAnswer, source } = item;
      if (!stem || !optionA || !optionB || !optionC || !optionD) {
        errors.push(`שאלה "${stem.slice(0, 40)}" — חסרים שדות`);
        continue;
      }

      const normNew = normalize(stem);
      const dup = existingNormed.find((q) => q.norm === normNew);
      if (dup) {
        skipped.push({ stem, existingId: dup.id });
        continue;
      }

      const created = await db.question.create({
        data: {
          chapterId: defaultChapter.id,
          chapterIds: [defaultChapter.id], // placeholder; RAG will overwrite from evidence
          stem,
          optionA,
          optionB,
          optionC,
          optionD,
          correctAnswer,
          source: source ?? null,
          createdById: me.id,
        },
      });
      // Enqueue a generation job — admin runs them from the Queue Center.
      await db.answerGenerationJob.create({
        data: { questionId: created.id, kind: "INITIAL", createdById: me.id },
      });
      saved.push({ id: created.id, stem });
      // Add to in-memory list so later items in the same batch are also checked
      existingNormed.push({ id: created.id, stem, norm: normalize(stem) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`שגיאה: ${msg}`);
    }
  }

  return { saved, skipped, errors };
}

export type DuplicateCheckResult =
  | { duplicate: false }
  | { duplicate: true; existingId: number; existingStem: string };

export async function checkDuplicateBeforeParseAction(rawText: string): Promise<DuplicateCheckResult> {
  await requireAdmin();
  const normRaw = normalize(rawText.trim());
  if (normRaw.length < 15) return { duplicate: false };

  // Fetch all stems and compare in JS — no DB-side normalization quirks
  const allQuestions = await db.question.findMany({ select: { id: true, stem: true } });
  for (const q of allQuestions) {
    const normStem = normalize(q.stem);
    // Require stem to be at least 15 chars to avoid short-stem false positives
    if (normStem.length < 15) continue;
    if (normRaw.includes(normStem)) {
      return { duplicate: true, existingId: q.id, existingStem: q.stem };
    }
  }
  return { duplicate: false };
}

export async function parseQuestionAction(rawText: string): Promise<WizardParseResult> {
  await requireAdmin();
  if (!rawText?.trim() || rawText.trim().length < 20) {
    return { ok: false, error: "טקסט קצר מדי" };
  }
  try {
    const parsed = await parseQuestion(rawText);
    return { ok: true, parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function parseMultipleQuestionsAction(rawText: string): Promise<WizardMultiParseResult> {
  await requireAdmin();
  if (!rawText?.trim() || rawText.trim().length < 20) {
    return { ok: false, error: "טקסט קצר מדי" };
  }
  try {
    const parsed = await parseMultipleQuestions(rawText);
    if (parsed.length === 0) return { ok: false, error: "לא זוהו שאלות בטקסט" };
    return { ok: true, parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export type BatchDupeResult = Array<{ existingId: number; existingStem: string } | null>;

export async function checkBatchDuplicatesAction(stems: string[]): Promise<BatchDupeResult> {
  await requireAdmin();
  if (stems.length === 0) return [];
  const allQuestions = await db.question.findMany({ select: { id: true, stem: true } });
  const existingNormed = allQuestions.map((q) => ({ id: q.id, norm: normalize(q.stem) }));
  return stems.map((stem) => {
    const normStem = normalize(stem);
    if (normStem.length < 15) return null;
    const found = existingNormed.find((q) => q.norm === normStem);
    return found ? { existingId: found.id, existingStem: stem } : null;
  });
}

export async function saveWizardQuestionAction(formData: FormData) {
  const me = await requireAdmin();
  const stem = String(formData.get("stem") ?? "").trim();
  const optionA = String(formData.get("optionA") ?? "").trim();
  const optionB = String(formData.get("optionB") ?? "").trim();
  const optionC = String(formData.get("optionC") ?? "").trim();
  const optionD = String(formData.get("optionD") ?? "").trim();
  const rawCorrectAnswer = formData.get("correctAnswer");
  const correctAnswer =
    rawCorrectAnswer === "A" || rawCorrectAnswer === "B" || rawCorrectAnswer === "C" || rawCorrectAnswer === "D"
      ? rawCorrectAnswer
      : null;

  if (!stem || !optionA || !optionB || !optionC || !optionD) {
    throw new Error("All fields required");
  }

  // Placeholder chapter — RAG will overwrite chapterId/chapterIds from evidence
  const chapter = await db.chapter.findFirst({ orderBy: { number: "asc" } });
  if (!chapter) throw new Error("No chapters in DB — run db:seed first");

  const created = await db.question.create({
    data: {
      chapterId: chapter.id,
      chapterIds: [chapter.id], // placeholder; RAG will overwrite from evidence
      stem,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      createdById: me.id,
    },
  });

  // Enqueue a generation job — admin runs it from the Queue Center.
  await db.answerGenerationJob.create({
    data: { questionId: created.id, kind: "INITIAL", createdById: me.id },
  });

  redirect(`/admin/questions/${created.id}`);
}

