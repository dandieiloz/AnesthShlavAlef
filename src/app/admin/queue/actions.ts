"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { generateExplanationForQuestion } from "@/lib/rag";
import { revalidatePath } from "next/cache";
import type { JobStatus } from "@prisma/client";
import {
  estimateJobCost,
  estimateBatchCost,
  ESCALATION_PROB,
  COST_CONFIRM_THRESHOLD,
  type BatchCostEstimate,
} from "@/lib/pricing";
import { hashQuestion } from "@/lib/rag/hash";
import { invalidateTranslations } from "@/lib/translate";

// ─── Types returned to the client ───────────────────────────────────────────

export type RunJobResult =
  | { ok: true; jobId: number; status: "DONE" }
  | { ok: false; jobId: number; status: "FAILED" | "NOT_CLAIMABLE"; error?: string };

export type EnqueueResult =
  | { ok: true; jobId: number }
  | { ok: false; error: string };

// ─── Run a single job (PENDING|FAILED → PROCESSING → DONE|FAILED) ───────────

export async function runJobAction(jobId: number): Promise<RunJobResult> {
  await requireAdmin();

  // Transactional claim — only claim if still PENDING or FAILED
  const claimed = await db.answerGenerationJob.updateMany({
    where: { id: jobId, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
  });

  if (claimed.count === 0) {
    return { ok: false, jobId, status: "NOT_CLAIMABLE", error: "כבר בעיבוד או לא ניתן לבצע" };
  }

  const job = await db.answerGenerationJob.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, jobId, status: "NOT_CLAIMABLE", error: "Job not found" };

  // For REGENERATE jobs: delete the existing GeminiAnswer so generation runs fresh
  if (job.kind === "REGENERATE") {
    // Invalidate translations of the old answer (their entityId becomes orphaned
    // when a new GeminiAnswer row is inserted with a different autoincrement id).
    const old = await db.geminiAnswer.findUnique({
      where: { questionId: job.questionId },
      select: { id: true },
    });
    if (old) {
      await invalidateTranslations("GeminiAnswer", String(old.id));
    }
    await db.geminiAnswer.deleteMany({ where: { questionId: job.questionId } });
  }

  try {
    await generateExplanationForQuestion(job.questionId);
    await db.answerGenerationJob.update({
      where: { id: jobId },
      data: { status: "DONE", finishedAt: new Date(), lastError: null },
    });
    revalidatePath("/admin/queue");
    return { ok: true, jobId, status: "DONE" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.answerGenerationJob.update({
      where: { id: jobId },
      data: { status: "FAILED", finishedAt: new Date(), lastError: msg },
    });
    revalidatePath("/admin/queue");
    return { ok: false, jobId, status: "FAILED", error: msg };
  }
}

// ─── Cancel one or more jobs ─────────────────────────────────────────────────

export async function cancelJobsAction(jobIds: number[]): Promise<void> {
  await requireAdmin();
  await db.answerGenerationJob.updateMany({
    where: { id: { in: jobIds }, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  revalidatePath("/admin/queue");
}

// ─── Retry (FAILED|CANCELLED → PENDING) ──────────────────────────────────────

export async function retryJobsAction(jobIds: number[]): Promise<void> {
  await requireAdmin();
  await db.answerGenerationJob.updateMany({
    where: { id: { in: jobIds }, status: { in: ["FAILED", "CANCELLED"] } },
    data: { status: "PENDING", lastError: null, startedAt: null, finishedAt: null },
  });
  revalidatePath("/admin/queue");
}

// ─── Enqueue initial job for a question that has no answer yet ────────────────

export async function enqueueInitialJobAction(questionId: number): Promise<EnqueueResult> {
  await requireAdmin();

  // Guard: only one open job per question
  const existing = await db.answerGenerationJob.findFirst({
    where: { questionId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (existing) return { ok: false, error: "כבר יש משימה פתוחה לשאלה זו" };

  const job = await db.answerGenerationJob.create({
    data: { questionId, kind: "INITIAL" },
  });
  revalidatePath("/admin/queue");
  revalidatePath(`/admin/questions/${questionId}`);
  return { ok: true, jobId: job.id };
}

// ─── Enqueue a re-generation job ──────────────────────────────────────────────

export async function enqueueRegenerationAction(questionId: number): Promise<EnqueueResult> {
  await requireAdmin();

  // Guard: only one open job per question
  const existing = await db.answerGenerationJob.findFirst({
    where: { questionId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (existing) return { ok: false, error: "כבר יש משימה פתוחה לשאלה זו" };

  const job = await db.answerGenerationJob.create({
    data: { questionId, kind: "REGENERATE" },
  });
  revalidatePath("/admin/queue");
  revalidatePath(`/admin/questions/${questionId}`);
  return { ok: true, jobId: job.id };
}

// ─── Delete DONE/CANCELLED jobs older than N days ─────────────────────────────

export async function cleanupDoneJobsAction(olderThanDays = 7): Promise<number> {
  await requireAdmin();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  // Catch both rows with finishedAt set and legacy rows that only have queuedAt
  const result = await db.answerGenerationJob.deleteMany({
    where: {
      status: { in: ["DONE", "CANCELLED"] },
      OR: [
        { finishedAt: { lt: cutoff } },
        { AND: [{ finishedAt: null }, { queuedAt: { lt: cutoff } }] },
      ],
    },
  });
  revalidatePath("/admin/queue");
  return result.count;
}

// ─── Status counts (used for badge + stats bar) ───────────────────────────────

export async function getQueueStatsAction(): Promise<Record<JobStatus, number>> {
  await requireAdmin();
  const counts = await db.answerGenerationJob.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const base: Record<JobStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    DONE: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  for (const row of counts) base[row.status] = row._count.id;
  return base;
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

export type CostEstimateResult = BatchCostEstimate & {
  /** Per-job breakdown (jobId, estimated USD, whether it was a cache hit). */
  jobs: Array<{ jobId: number; usd: number; cached: boolean }>;
  /** Spending threshold (USD) above which the UI should ask for confirmation. */
  confirmThreshold: number;
  /**
   * Average latency (ms) per job from the last 50 real non-cached RagRun records.
   * Used to pre-compute an estimated batch duration.
   * Falls back to 30 000 ms on fresh deployments with no history yet.
   */
  avgLatencyMs: number;
};

/**
 * Estimates the approximate Gemini API cost for running a set of PENDING/FAILED
 * jobs without actually calling any API. Performs only DB reads.
 * Returns $0 for any job whose question already has a QuestionQueryCache entry.
 */
export async function estimateJobsCostAction(
  jobIds: number[],
): Promise<CostEstimateResult> {
  await requireAdmin();

  // Average latency from last 50 non-cached runs — used for time estimation.
  const recentRuns = await db.ragRun.findMany({
    where: { cacheHit: false, latencyMs: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { latencyMs: true },
  });
  const avgLatencyMs =
    recentRuns.length > 0
      ? recentRuns.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) / recentRuns.length
      : 30_000; // 30 s fallback for fresh deployments with no history

  const empty: CostEstimateResult = {
    totalUsd: 0,
    cachedCount: 0,
    jobCount: 0,
    escalationPct: Math.round(ESCALATION_PROB * 100),
    byStage: { embedHe: 0, translate: 0, embedEn: 0, rerank: 0, flashGen: 0, escalation: 0 },
    jobs: [],
    confirmThreshold: COST_CONFIRM_THRESHOLD,
    avgLatencyMs,
  };

  if (jobIds.length === 0) return empty;

  const jobs = await db.answerGenerationJob.findMany({
    where: { id: { in: jobIds } },
    include: {
      question: {
        select: {
          id: true,
          stem: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          stemEn: true,
        },
      },
    },
  });

  // Compute hashes for all questions so we can batch-check the cache.
  const hashes = jobs.map((j) =>
    hashQuestion({
      stem: j.question.stem,
      optionA: j.question.optionA,
      optionB: j.question.optionB,
      optionC: j.question.optionC,
      optionD: j.question.optionD,
    }),
  );

  const cachedRows = await db.questionQueryCache.findMany({
    where: { questionHash: { in: hashes } },
    select: { questionHash: true },
  });
  const cachedHashes = new Set(cachedRows.map((r) => r.questionHash));

  const jobEstimates = jobs.map((j, i) => {
    const cached = cachedHashes.has(hashes[i]);
    const estimate = estimateJobCost({
      stem: j.question.stem,
      optionA: j.question.optionA,
      optionB: j.question.optionB,
      optionC: j.question.optionC,
      optionD: j.question.optionD,
      hasStemEn: !!j.question.stemEn,
      cached,
    });
    return { jobId: j.id, estimate };
  });

  const batch = estimateBatchCost(jobEstimates);

  return {
    ...batch,
    jobs: jobEstimates.map(({ jobId, estimate }) => ({
      jobId,
      usd: estimate.totalUsd,
      cached: estimate.cached,
    })),
    confirmThreshold: COST_CONFIRM_THRESHOLD,
    avgLatencyMs,
  };
}
