"use server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";
import { extractTextFromFile, FileExtractionError } from "@/lib/submission-extract";

export type SubmitContributionResult = { ok: true } | { ok: false; error: string };

const MIN_TEXT_CHARS = 20;
const MAX_TEXT_CHARS = 50_000;
const MAX_META_CHARS = 200;

// Anti-abuse: at most 5 submissions per 10 minutes per user (or per IP when anonymous).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function clampMeta(v: FormDataEntryValue | null): string | null {
  const s = (typeof v === "string" ? v : "").trim();
  return s ? s.slice(0, MAX_META_CHARS) : null;
}

function parseYear(v: FormDataEntryValue | null): number | null {
  const s = (typeof v === "string" ? v : "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1990 && n <= 2100 ? n : null;
}

async function clientKey(userId: string | null): Promise<string> {
  if (userId) return `contribute:user:${userId}`;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `contribute:ip:${ip}`;
}

export async function submitContributionAction(formData: FormData): Promise<SubmitContributionResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // ── Anti-abuse: per-user / per-IP rate limit ──
  const limited = rateLimit(await clientKey(userId), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    const mins = Math.max(1, Math.ceil(limited.retryAfterSeconds / 60));
    return { ok: false, error: `נשלחו יותר מדי בקשות. נסו שוב בעוד כ-${mins} דקות.` };
  }

  // ── Required metadata ──
  const institute = clampMeta(formData.get("institute"));
  if (!institute) return { ok: false, error: "יש לבחור או להזין מוסד" };

  const year = parseYear(formData.get("year"));
  const chapterHint = clampMeta(formData.get("chapterHint"));
  const doctorName = clampMeta(formData.get("doctorName"));

  // ── Content: an uploaded file (logged-in only) takes precedence over pasted text ──
  let rawText: string | null = null;
  let extractedText: string | null = null;
  let fileName: string | null = null;

  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (hasFile) {
    if (!userId) {
      return { ok: false, error: "העלאת קבצים זמינה רק למשתמשים מחוברים. התחברו או הדביקו את הטקסט." };
    }
    try {
      const extracted = await extractTextFromFile(file);
      extractedText = extracted.text.slice(0, MAX_TEXT_CHARS);
      fileName = extracted.fileName.slice(0, MAX_META_CHARS);
    } catch (e) {
      return { ok: false, error: e instanceof FileExtractionError ? e.message : "שגיאה בקריאת הקובץ" };
    }
  } else {
    const rawVal = formData.get("rawText");
    const pasted = (typeof rawVal === "string" ? rawVal : "").trim();
    if (pasted.length < MIN_TEXT_CHARS) {
      return { ok: false, error: "נא להדביק שאלות (לפחות מספר שורות) או להעלות קובץ" };
    }
    if (pasted.length > MAX_TEXT_CHARS) {
      return { ok: false, error: "הטקסט ארוך מדי. חלקו אותו למספר שליחות." };
    }
    rawText = pasted;
  }

  await db.questionSubmission.create({
    data: {
      rawText,
      extractedText,
      fileName,
      institute,
      year,
      chapterHint,
      doctorName,
      submittedById: userId,
      status: "NEW",
    },
  });

  revalidatePath("/admin/submissions");
  return { ok: true };
}
