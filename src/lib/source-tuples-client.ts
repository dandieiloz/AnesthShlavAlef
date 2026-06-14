"use client";

import {
  getQuestionSourceTuplesAction,
  type QuestionSourceTuple,
} from "@/lib/question-source-actions";

/** Module-level cache so repeated mounts don't re-query the same admin session. */
let tuplesCache: Promise<QuestionSourceTuple[]> | null = null;

/** Loads the distinct {institution, year, group} tuples, cached per session. */
export function loadSourceTuples(): Promise<QuestionSourceTuple[]> {
  if (!tuplesCache) tuplesCache = getQuestionSourceTuplesAction().catch(() => []);
  return tuplesCache;
}

export type { QuestionSourceTuple };
