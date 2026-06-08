"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Type } from "@google/genai";
import { generateJson, FLASH_MODEL } from "@/lib/gemini";
import {
  scanFieldText,
  autoFixText,
  hasAutoFixableIssue,
  type FieldIssue,
} from "@/lib/formatting-scan";
import type { IssueSource, ScanRecord, ScanResult } from "./types";

// Allowlists guard which DB columns a fix may write — never trust a raw field name.
const QUESTION_FIELDS = ["stem", "optionA", "optionB", "optionC", "optionD"] as const;
const ANSWER_FIELDS = ["explanation", "whyOthersWrong", "rawMarkdown"] as const;

const FIELD_LABELS: Record<string, string> = {
  stem: "גוף השאלה",
  optionA: "תשובה A",
  optionB: "תשובה B",
  optionC: "תשובה C",
  optionD: "תשובה D",
  explanation: "הסבר",
  whyOthersWrong: "מדוע האחרות שגויות",
  rawMarkdown: "Markdown גולמי",
  quote: "ציטוט ראיה",
};

type EvidenceCitation = {
  chapterNumber?: number;
  chapterTitle?: string;
  sectionPath?: string | null;
  quote?: string;
  pageStart?: number;
  pageEnd?: number;
};

function stemPreview(stem: string): string {
  const s = stem.trim().replace(/\s+/g, " ");
  return s.length > 90 ? `${s.slice(0, 90)}…` : s;
}

function parseCitations(value: unknown): EvidenceCitation[] | null {
  if (!Array.isArray(value)) return null;
  return value as EvidenceCitation[];
}

// --- Scan ------------------------------------------------------------------

export async function scanFormattingIssuesAction(): Promise<ScanResult> {
  await requireAdmin();

  const questions = await db.question.findMany({
    select: {
      id: true,
      stem: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      geminiAnswer: {
        select: {
          explanation: true,
          whyOthersWrong: true,
          rawMarkdown: true,
          evidenceCitations: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const records: ScanRecord[] = [];

  const pushIfIssues = (
    rec: Omit<ScanRecord, "issues" | "autoFixed" | "original"> & { value: string },
  ) => {
    const issues: FieldIssue[] = scanFieldText(rec.value);
    if (issues.length === 0) return;
    const fixed = hasAutoFixableIssue(issues) ? autoFixText(rec.value) : null;
    records.push({
      questionId: rec.questionId,
      source: rec.source,
      field: rec.field,
      fieldLabel: rec.fieldLabel,
      citationIndex: rec.citationIndex,
      stemPreview: rec.stemPreview,
      original: rec.value,
      autoFixed: fixed && fixed !== rec.value ? fixed : null,
      issues,
    });
  };

  for (const q of questions) {
    const preview = stemPreview(q.stem);

    for (const field of QUESTION_FIELDS) {
      pushIfIssues({
        questionId: q.id,
        source: "QUESTION",
        field,
        fieldLabel: FIELD_LABELS[field],
        citationIndex: null,
        stemPreview: preview,
        value: q[field],
      });
    }

    const ans = q.geminiAnswer;
    if (ans) {
      for (const field of ANSWER_FIELDS) {
        pushIfIssues({
          questionId: q.id,
          source: "ANSWER",
          field,
          fieldLabel: FIELD_LABELS[field],
          citationIndex: null,
          stemPreview: preview,
          value: ans[field],
        });
      }

      const citations = parseCitations(ans.evidenceCitations);
      if (citations) {
        citations.forEach((c, idx) => {
          if (typeof c?.quote !== "string") return;
          pushIfIssues({
            questionId: q.id,
            source: "EVIDENCE",
            field: "quote",
            fieldLabel: `${FIELD_LABELS.quote} #${idx + 1}`,
            citationIndex: idx,
            stemPreview: preview,
            value: c.quote,
          });
        });
      }
    }
  }

  return {
    records,
    scannedQuestions: questions.length,
    totalIssues: records.reduce((n, r) => n + r.issues.length, 0),
  };
}

// --- Read / write a single field -------------------------------------------

async function readField(
  questionId: number,
  source: IssueSource,
  field: string,
  citationIndex: number | null,
): Promise<string | null> {
  if (source === "QUESTION") {
    if (!(QUESTION_FIELDS as readonly string[]).includes(field)) return null;
    const q = await db.question.findUnique({ where: { id: questionId } });
    return q ? (q[field as (typeof QUESTION_FIELDS)[number]] as string) : null;
  }
  const ans = await db.geminiAnswer.findUnique({ where: { questionId } });
  if (!ans) return null;
  if (source === "ANSWER") {
    if (!(ANSWER_FIELDS as readonly string[]).includes(field)) return null;
    return ans[field as (typeof ANSWER_FIELDS)[number]] as string;
  }
  // EVIDENCE
  const citations = parseCitations(ans.evidenceCitations);
  if (!citations || citationIndex == null) return null;
  const c = citations[citationIndex];
  return typeof c?.quote === "string" ? c.quote : null;
}

async function writeField(
  questionId: number,
  source: IssueSource,
  field: string,
  citationIndex: number | null,
  value: string,
): Promise<void> {
  if (source === "QUESTION") {
    if (!(QUESTION_FIELDS as readonly string[]).includes(field)) return;
    await db.question.update({ where: { id: questionId }, data: { [field]: value } });
    return;
  }
  if (source === "ANSWER") {
    if (!(ANSWER_FIELDS as readonly string[]).includes(field)) return;
    await db.geminiAnswer.update({ where: { questionId }, data: { [field]: value } });
    return;
  }
  // EVIDENCE — patch the quote inside the JSON array, leave siblings untouched.
  const ans = await db.geminiAnswer.findUnique({ where: { questionId } });
  if (!ans) return;
  const citations = parseCitations(ans.evidenceCitations);
  if (!citations || citationIndex == null || !citations[citationIndex]) return;
  citations[citationIndex] = { ...citations[citationIndex], quote: value };
  await db.geminiAnswer.update({
    where: { questionId },
    data: { evidenceCitations: citations as object[] },
  });
}

function revalidate() {
  revalidatePath("/admin/formatting-issues");
}

// --- Apply actions ---------------------------------------------------------

/** Recompute the deterministic auto-fix from the current value and persist it. */
export async function applyAutoFixAction(input: {
  questionId: number;
  source: IssueSource;
  field: string;
  citationIndex: number | null;
}): Promise<{ ok: boolean; value?: string }> {
  await requireAdmin();
  const current = await readField(input.questionId, input.source, input.field, input.citationIndex);
  if (current == null) return { ok: false };
  const fixed = autoFixText(current);
  if (fixed === current) return { ok: true, value: current };
  await writeField(input.questionId, input.source, input.field, input.citationIndex, fixed);
  revalidate();
  return { ok: true, value: fixed };
}

/** Persist an admin-reviewed value (used to accept a Gemini suggestion or manual edit). */
export async function applyManualFixAction(input: {
  questionId: number;
  source: IssueSource;
  field: string;
  citationIndex: number | null;
  value: string;
}): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (typeof input.value !== "string" || input.value.length === 0) return { ok: false };
  await writeField(input.questionId, input.source, input.field, input.citationIndex, input.value);
  revalidate();
  return { ok: true };
}

/** Apply every deterministic auto-fix across the whole DB. Returns how many fields changed. */
export async function applyBulkAutoFixesAction(): Promise<{ changed: number }> {
  await requireAdmin();
  const { records } = await scanFormattingIssuesAction();
  let changed = 0;
  for (const r of records) {
    if (!r.autoFixed) continue;
    const current = await readField(r.questionId, r.source, r.field, r.citationIndex);
    if (current == null) continue;
    const fixed = autoFixText(current);
    if (fixed === current) continue;
    await writeField(r.questionId, r.source, r.field, r.citationIndex, fixed);
    changed++;
  }
  if (changed > 0) revalidate();
  return { changed };
}

// --- Gemini-assisted suggestion (no write) ---------------------------------

const GEMINI_SYSTEM = [
  "אתה עוזר עריכה שמתקן בעיות עיצוב בטקסט רפואי בעברית (Markdown עם נוסחאות KaTeX).",
  "המשימה: לתקן אך ורק בעיות עיצוב/רינדור — בלי לשנות את המשמעות, העובדות או השפה.",
  "כללים:",
  "- החלף תווי בריחה מילוליים (\\n, \\t) ברווח או שורה חדשה לפי ההקשר.",
  "- ודא שתוחמי $ וסוגריים { } מאוזנים; עטוף נוסחאות LaTeX אמיתיות ב-$...$.",
  "- אל תהפוך טקסט רגיל (פרוזה) לנוסחה מתמטית; טקסט רגיל צריך להישאר רגיל עם רווחים.",
  "- שמור על העברית, המספרים והמונחים המקצועיים בדיוק כפי שהם.",
  "החזר JSON עם השדה corrected בלבד.",
].join("\n");

export async function suggestGeminiFixAction(input: {
  questionId: number;
  source: IssueSource;
  field: string;
  citationIndex: number | null;
}): Promise<{ ok: boolean; suggestion?: string }> {
  await requireAdmin();
  const current = await readField(input.questionId, input.source, input.field, input.citationIndex);
  if (current == null) return { ok: false };

  const result = await generateJson<{ corrected?: string }>(
    FLASH_MODEL,
    GEMINI_SYSTEM,
    `תקן את בעיות העיצוב בטקסט הבא:\n\n${current}`,
    {
      type: Type.OBJECT,
      properties: { corrected: { type: Type.STRING } },
      required: ["corrected"],
    },
    0.1,
  );

  const suggestion = typeof result.corrected === "string" ? result.corrected : undefined;
  if (!suggestion) return { ok: false };
  return { ok: true, suggestion };
}
