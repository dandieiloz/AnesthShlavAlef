/**
 * Read-only: cost of the plan gate and of the main table scans.
 *   npx tsx scripts/perf-probe-gate.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const out = await fn();
  console.log(`${label.padEnd(40)} ${(performance.now() - t0).toFixed(0).padStart(6)} ms`);
  return out;
}

async function main() {
  await prisma.$queryRaw`SELECT 1`; // warm the connection
  const [attempts, questions, quizzes, users] = await Promise.all([
    prisma.attempt.count(),
    prisma.question.count(),
    prisma.quiz.count(),
    prisma.user.count(),
  ]);
  console.log({ attempts, questions, quizzes, users });

  const { questionAccessWhere } = await import("../src/lib/plan");
  const { getAutoHiddenQuestionIds } = await import("../src/lib/auto-hide-threshold");
  const paid = { id: "x", role: "USER" as const, plan: "PAID" as const };
  for (let i = 0; i < 3; i++) await time(`questionAccessWhere (PAID) #${i + 1}`, () => questionAccessWhere(paid));
  await time("auto-hide GROUP BY over all attempts", () => getAutoHiddenQuestionIds());

  const plans = await prisma.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(
    `EXPLAIN ANALYZE SELECT "isCorrect","createdAt","quizId" FROM "Attempt" WHERE "quizId" IN (SELECT id FROM "Quiz" ORDER BY id DESC LIMIT 60)`,
  );
  console.log("\nattempts-by-quizId plan:\n" + plans.map((p) => p["QUERY PLAN"]).join("\n"));

  const idx = await prisma.$queryRawUnsafe<{ tablename: string; indexdef: string }[]>(
    `SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('Attempt','Quiz','Bookmark','SentenceHighlight','ForumReply','ForumThread','AnswerReport','DebugReport') ORDER BY tablename`,
  );
  console.log("\nindexes:");
  for (const r of idx) console.log(`  ${r.tablename}: ${r.indexdef.replace(/^CREATE (UNIQUE )?INDEX /, "")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
