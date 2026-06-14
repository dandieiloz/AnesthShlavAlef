"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Matches "<institution> <year> <group>" where the trailing group is optional. */
const SOURCE_RE = /^(.+?)\s+(\d{4})(?:\s+(.+))?$/;

/**
 * Returns the distinct, non-empty group ("קבוצה") suffixes used across existing
 * questions, sorted alphabetically. Available to any signed-in user.
 */
export async function getQuestionGroupsAction(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await db.question.findMany({
    where: { source: { not: null } },
    select: { source: true },
    distinct: ["source"],
  });

  const groups = new Set<string>();
  for (const { source } of rows) {
    const m = source?.match(SOURCE_RE);
    const group = m?.[3]?.trim();
    if (group) groups.add(group);
  }

  return [...groups].sort((a, b) => a.localeCompare(b, "he"));
}

export type QuestionSourceTuple = {
  institution: string;
  year: string;
  group: string | null;
};

/**
 * Returns the distinct parsed {institution, year, group} tuples used across
 * existing questions. Drives the cascading מוסד → שנה → קבוצה selectors in the
 * admin Question Management UI. Available to any signed-in user.
 */
export async function getQuestionSourceTuplesAction(): Promise<QuestionSourceTuple[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const rows = await db.question.findMany({
    where: { source: { not: null } },
    select: { source: true },
    distinct: ["source"],
  });

  const seen = new Set<string>();
  const tuples: QuestionSourceTuple[] = [];
  for (const { source } of rows) {
    const m = source?.match(SOURCE_RE);
    if (!m) continue;
    const institution = m[1]?.trim();
    const year = m[2]?.trim();
    if (!institution || !year) continue;
    const group = m[3]?.trim() || null;
    const key = `${institution}\u0000${year}\u0000${group ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tuples.push({ institution, year, group });
  }

  return tuples;
}
