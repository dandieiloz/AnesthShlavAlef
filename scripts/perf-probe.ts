/**
 * Read-only performance probe. Measures database round-trip latency from the
 * machine running it, then replays the data loading of the main pages for the
 * most active user and reports wall time + number of SQL queries per page.
 *
 *   npx tsx scripts/perf-probe.ts
 *
 * Nothing is written to the database and no personal data is printed.
 */
import "dotenv/config";
import Module from "node:module";
import { PrismaClient } from "@prisma/client";

// `server-only` is provided by Next.js at build time; stub it for this script.
const mod = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = mod._load;
mod._load = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...rest);
};

const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let queryCount = 0;
prisma.$on("query", () => {
  queryCount++;
});
// lib/db.ts reuses globalThis.prisma when present, so every helper below
// goes through this instrumented client.
(globalThis as unknown as { prisma: PrismaClient }).prisma = prisma;

async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const q0 = queryCount;
  const t0 = performance.now();
  const out = await fn();
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms  ${String(queryCount - q0).padStart(3)} queries`);
  return out;
}

async function main() {
  // Round-trip latency (first call includes connection setup / compute wake-up).
  for (let i = 0; i < 5; i++) {
    await measure(`SELECT 1 #${i + 1}`, () => prisma.$queryRaw`SELECT 1`);
  }

  const top = await prisma.attempt.groupBy({
    by: ["userId"],
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: 1,
  });
  if (top.length === 0) throw new Error("no attempts in DB");
  const userId = top[0].userId;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, plan: true } });
  const me = { id: u.id, role: u.role, plan: u.plan } as { id: string; role: "USER" | "ADMIN"; plan: "DEMO" | "PAID" };
  const quizCount = await prisma.quiz.count({ where: { userId } });
  console.log(`\nprobe user: ${top[0]._count._all} attempts, ${quizCount} quizzes\n`);

  const { countUnseenAdminResponses, countUnreadForumThreads } = await import("../src/lib/notifications");
  const { getUserProgress } = await import("../src/lib/user-progress");
  const { getQuizRows } = await import("../src/lib/quiz-rows");
  const { getExamPlanData } = await import("../src/lib/exam-plan");
  const { getMyQuestionCounts } = await import("../src/lib/my-questions");
  const { getActivityHeatmap } = await import("../src/lib/activity");
  const { getHospitalActivity24h } = await import("../src/lib/community-stats");

  for (const pass of [1, 2]) {
  console.log(`
===== pass ${pass} =====`);
  console.log("— every page (root layout) —");
  await measure("layout: unseen responses", () => countUnseenAdminResponses(userId));
  await measure("layout: unread forum", () => countUnreadForumThreads(userId));
  await measure("layout: level progress", () => getUserProgress(userId));
  await measure("layout: all three in parallel", () =>
    Promise.all([countUnseenAdminResponses(userId), countUnreadForumThreads(userId), getUserProgress(userId)]),
  );

  console.log("\n— Home —");
  await measure("getQuizRows", () => getQuizRows(me));
  await measure("getExamPlanData", () => getExamPlanData(me));
  await measure("getMyQuestionCounts", () => getMyQuestionCounts(me, "he"));
  await measure("getActivityHeatmap", () => getActivityHeatmap(userId, 120));
  await measure("getHospitalActivity24h", () => getHospitalActivity24h());
  await measure("Home: all in parallel", () =>
    Promise.all([
      getQuizRows(me),
      getExamPlanData(me),
      getMyQuestionCounts(me, "he"),
      getActivityHeatmap(userId, 120),
      getHospitalActivity24h(),
      getUserProgress(userId),
    ]),
  );

  console.log("\n— Progress —");
  await measure("all attempts with chapter", () =>
    prisma.attempt.findMany({
      where: { userId },
      select: { isCorrect: true, question: { select: { chapter: { select: { number: true } } } } },
    }),
  );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
