import { db } from "@/lib/db";
import { notFound } from "next/navigation";

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
  if (user.role === "ADMIN") return {};
  // Non-admin users never see disabled questions.
  const baseGate: Record<string, unknown> = { disabled: false };
  if (user.plan === "PAID") return baseGate;
  const { sources, allowNullSource } = await getDemoAllowedSources();
  if (sources.length === 0 && !allowNullSource) {
    return { id: -1 };
  }
  const or: Array<Record<string, unknown>> = [];
  if (sources.length > 0) or.push({ source: { in: sources } });
  if (allowNullSource) or.push({ source: null });
  const sourceGate = or.length === 1 ? or[0] : { OR: or };
  return { ...baseGate, ...sourceGate };
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
    select: { source: true, disabled: true },
  });
  if (!q) notFound();
  if (q.disabled) notFound();
  if (user.plan === "PAID") return;
  const { sources, allowNullSource } = await getDemoAllowedSources();
  if (q.source === null) {
    if (!allowNullSource) notFound();
    return;
  }
  if (!sources.includes(q.source)) notFound();
}

export { NULL_SOURCE_SENTINEL };
