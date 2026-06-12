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
