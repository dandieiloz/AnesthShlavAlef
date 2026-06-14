import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getPublishConfidenceThreshold } from "@/lib/publish-threshold";
import { getAutoHideConfig, getAutoHiddenQuestionIds } from "@/lib/auto-hide-threshold";

const NULL_SOURCE_SENTINEL = "__NULL__";

export type PlanGatedUser = {
  id: string;
  role: "USER" | "ADMIN";
  plan: "DEMO" | "PAID";
};

export type DemoAllowedConfig = {
  sources: string[];
  allowNullSource: boolean;
};

export async function getDemoAllowedSources(): Promise<DemoAllowedConfig> {
  const rows = await db.demoAllowedSource.findMany({ select: { source: true } });
  let allowNullSource = false;
  const sources: string[] = [];
  for (const r of rows) {
    if (r.source === NULL_SOURCE_SENTINEL) allowNullSource = true;
    else sources.push(r.source);
  }
  return { sources, allowNullSource };
}

/** No-op kept for callers that mutate the allowlist; admin pages also call revalidatePath. */
export function invalidateDemoAllowedSources() {}

/**
 * Returns a Prisma `where` fragment to AND-merge into Question queries so that
 * DEMO users only see questions whose `source` is in the allowlist.
 * ADMIN and PAID users get an empty fragment (no restriction).
 */
export async function questionAccessWhere(user: PlanGatedUser) {
  // Disabled questions are excluded from all question pools/listings for
  // everyone, admins included (admins bypass only the publish/source gates).
  if (user.role === "ADMIN") return { disabled: false };
  // Non-admin users never see disabled questions.
  const baseGate: Record<string, unknown> = { disabled: false };
  // Publish gate: confidence >= configured threshold OR admin manually approved the answer.
  const threshold = await getPublishConfidenceThreshold();
  const publishGate: Record<string, unknown> = {
    OR: [
      { adminApproved: true },
      { geminiAnswer: { is: { confidence: { gte: threshold } } } },
    ],
  };
  // Auto-hide gate: questions with enough attempts AND a low correct-answer ratio
  // are hidden (likely a bad answer key), unless an admin manually approved them.
  const hiddenIds = await getAutoHiddenQuestionIds();
  const gates: Array<Record<string, unknown>> = [publishGate];
  if (hiddenIds.length > 0) {
    gates.push({ OR: [{ adminApproved: true }, { id: { notIn: hiddenIds } }] });
  }
  if (user.plan === "PAID") {
    return { ...baseGate, AND: gates };
  }
  const { sources, allowNullSource } = await getDemoAllowedSources();
  if (sources.length === 0 && !allowNullSource) {
    return { id: -1 };
  }
  const or: Array<Record<string, unknown>> = [];
  if (sources.length > 0) or.push({ source: { in: sources } });
  if (allowNullSource) or.push({ source: null });
  const sourceGate = or.length === 1 ? or[0] : { OR: or };
  return { ...baseGate, ...sourceGate, AND: gates };
}

/**
 * Combine an existing Question `where` with the plan-gating fragment.
 * Use this when the caller already has filters they want to AND with.
 */
export async function withQuestionAccess<T extends Record<string, unknown>>(
  user: PlanGatedUser,
  where: T
): Promise<T> {
  const gate = await questionAccessWhere(user);
  if (!gate || Object.keys(gate).length === 0) return where;
  const existingAnd = (where as { AND?: unknown }).AND;
  const merged = { ...where, AND: existingAnd ? [...(existingAnd as unknown[]), gate] : [gate] } as T;
  return merged;
}

/**
 * Throws notFound() if a DEMO user is not allowed to access this question.
 * Use for single-question routes (/quiz/[id], single fetches).
 */
export async function assertCanAccessQuestion(user: PlanGatedUser, questionId: number): Promise<void> {
  if (user.role === "ADMIN") return;
  const q = await db.question.findUnique({
    where: { id: questionId },
    select: {
      source: true,
      disabled: true,
      adminApproved: true,
      geminiAnswer: { select: { confidence: true } },
    },
  });
  if (!q) notFound();
  if (q.disabled) notFound();
  // Publish gate: must be admin-approved OR have an answer at/above threshold.
  if (!q.adminApproved) {
    const threshold = await getPublishConfidenceThreshold();
    const conf = q.geminiAnswer?.confidence ?? null;
    if (conf === null || conf < threshold) notFound();
    // Auto-hide gate: enough attempts AND a low correct-answer ratio hides the question.
    const autoHide = await getAutoHideConfig();
    if (autoHide.minAttempts > 0) {
      const [attempts, correct] = await Promise.all([
        db.attempt.count({ where: { questionId } }),
        db.attempt.count({ where: { questionId, isCorrect: true } }),
      ]);
      if (attempts >= autoHide.minAttempts && correct / attempts <= autoHide.maxCorrectPercent) {
        notFound();
      }
    }
  }
  if (user.plan === "PAID") return;
  const { sources, allowNullSource } = await getDemoAllowedSources();
  if (q.source === null) {
    if (!allowNullSource) notFound();
    return;
  }
  if (!sources.includes(q.source)) notFound();
}

/**
 * Predicate for "this question can be served to a learner". Most questions
 * have a generated `GeminiAnswer`. Image-based questions cannot be answered
 * by Gemini by design, so admins set `Question.correctAnswer` directly when
 * they upload an image; we accept those too. Non-admin visibility is still
 * subject to the publish gate inside `questionAccessWhere` (which requires
 * `adminApproved: true` when there is no `GeminiAnswer`).
 */
export const hasUsableAnswerWhere: Prisma.QuestionWhereInput = {
  OR: [
    { geminiAnswer: { isNot: null } },
    { imageUrl: { not: null }, correctAnswer: { not: null } },
  ],
};

export { NULL_SOURCE_SENTINEL };
