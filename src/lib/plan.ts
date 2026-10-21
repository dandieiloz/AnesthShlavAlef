import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getPublishConfidenceThreshold } from "@/lib/publish-threshold";
import { getAutoHiddenQuestionIds } from "@/lib/auto-hide-threshold";
import { cached, invalidate } from "@/lib/ttl-cache";

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

const DEMO_SOURCES_CACHE_KEY = "site:demoAllowedSources";

export async function getDemoAllowedSources(): Promise<DemoAllowedConfig> {
  return cached(DEMO_SOURCES_CACHE_KEY, 60_000, loadDemoAllowedSources);
}

async function loadDemoAllowedSources(): Promise<DemoAllowedConfig> {
  const rows = await db.demoAllowedSource.findMany({ select: { source: true } });
  let allowNullSource = false;
  const sources: string[] = [];
  for (const r of rows) {
    if (r.source === NULL_SOURCE_SENTINEL) allowNullSource = true;
    else sources.push(r.source);
  }
  return { sources, allowNullSource };
}

/** Called by admin actions that change the demo allowlist. */
export function invalidateDemoAllowedSources() {
  invalidate(DEMO_SOURCES_CACHE_KEY);
}

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
  // Settings and the hidden list are cached, and loaded in parallel on a miss.
  const [threshold, hiddenIds] = await Promise.all([getPublishConfidenceThreshold(), getAutoHiddenQuestionIds()]);
  const publishGate: Record<string, unknown> = {
    OR: [
      { adminApproved: true },
      { geminiAnswer: { is: { confidence: { gte: threshold } } } },
    ],
  };
  // Auto-hide gate: questions with enough attempts AND a low correct-answer ratio
  // are hidden (likely a bad answer key), unless an admin manually approved them.
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
  // One round trip: the question row plus cached site settings, in parallel.
  const [q, threshold, hiddenIds, demo] = await Promise.all([
    db.question.findUnique({
      where: { id: questionId },
      select: {
        source: true,
        disabled: true,
        adminApproved: true,
        geminiAnswer: { select: { confidence: true } },
      },
    }),
    getPublishConfidenceThreshold(),
    getAutoHiddenQuestionIds(),
    user.plan === "PAID" ? Promise.resolve(null) : getDemoAllowedSources(),
  ]);
  if (!q) notFound();
  if (q.disabled) notFound();
  if (!q.adminApproved) {
    // Publish gate: must be admin-approved OR have an answer at/above threshold.
    const conf = q.geminiAnswer?.confidence ?? null;
    if (conf === null || conf < threshold) notFound();
    // Auto-hide gate: enough attempts AND a low correct-answer ratio hides the question.
    if (hiddenIds.includes(questionId)) notFound();
  }
  if (!demo) return;
  if (q.source === null) {
    if (!demo.allowNullSource) notFound();
    return;
  }
  if (!demo.sources.includes(q.source)) notFound();
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
