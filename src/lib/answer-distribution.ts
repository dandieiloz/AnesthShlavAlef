import { db } from "@/lib/db";
import type { AnswerDistributionData } from "@/components/AnswerDistribution";

/** Per-option attempt tally for a question. Re-exported for action signatures. */
export type AnswerDistribution = AnswerDistributionData;

const EMPTY: AnswerDistributionData = { A: 0, B: 0, C: 0, D: 0 };

function fromGroups(
  groups: { chosen: "A" | "B" | "C" | "D"; _count: { _all: number } }[],
): AnswerDistributionData {
  const dist: AnswerDistributionData = { A: 0, B: 0, C: 0, D: 0 };
  for (const g of groups) dist[g.chosen] = g._count._all;
  return dist;
}

/**
 * Per-attempt tally of how many users picked each option (A/B/C/D) for a single
 * question. Counts every attempt (consistent with the "סה״כ ניסיונות" stat).
 */
export async function getAnswerDistribution(
  questionId: number,
): Promise<AnswerDistributionData> {
  const groups = await db.attempt.groupBy({
    by: ["chosen"],
    where: { questionId },
    _count: { _all: true },
  });
  return fromGroups(groups);
}

/**
 * Batch variant: returns a Map from questionId to its per-option distribution.
 * Questions with no attempts are omitted from the map; callers should treat a
 * missing entry as all-zero (which renders nothing).
 */
export async function getAnswerDistributions(
  questionIds: number[],
): Promise<Map<number, AnswerDistributionData>> {
  const map = new Map<number, AnswerDistributionData>();
  if (questionIds.length === 0) return map;
  const groups = await db.attempt.groupBy({
    by: ["chosen", "questionId"],
    where: { questionId: { in: questionIds } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const existing = map.get(g.questionId) ?? { ...EMPTY };
    existing[g.chosen] = g._count._all;
    map.set(g.questionId, existing);
  }
  return map;
}
