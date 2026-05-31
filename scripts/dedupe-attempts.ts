/**
 * Collapse duplicate Attempt rows created before the client/server dedupe guards
 * landed. Two attempts are considered duplicates iff they share
 *   (userId, quizId, questionId, chosen)
 * and were created within WINDOW_MS of each other. Within each duplicate cluster
 * the earliest row is kept and the rest are deleted.
 *
 * Usage:
 *   npx tsx scripts/dedupe-attempts.ts            # dry run (default)
 *   npx tsx scripts/dedupe-attempts.ts --apply    # actually delete
 *   npx tsx scripts/dedupe-attempts.ts --apply --user <userId>
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WINDOW_MS = 60_000;

function parseArgs() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const userIdx = args.indexOf("--user");
  const userId = userIdx >= 0 ? args[userIdx + 1] : undefined;
  return { apply, userId };
}

async function main() {
  const { apply, userId } = parseArgs();
  console.log(
    `Mode: ${apply ? "APPLY (deletes will happen)" : "DRY RUN"}` +
      (userId ? `  | scope: user=${userId}` : "  | scope: all users"),
  );

  const attempts = await prisma.attempt.findMany({
    where: userId ? { userId } : undefined,
    select: {
      id: true,
      userId: true,
      quizId: true,
      questionId: true,
      chosen: true,
      createdAt: true,
    },
    orderBy: [
      { userId: "asc" },
      { quizId: "asc" },
      { questionId: "asc" },
      { chosen: "asc" },
      { createdAt: "asc" },
    ],
  });

  console.log(`Loaded ${attempts.length} attempts`);

  const toDelete: number[] = [];
  type Key = string;
  const lastSeen = new Map<Key, { id: number; createdAt: Date }>();

  for (const a of attempts) {
    const key: Key = `${a.userId}|${a.quizId ?? "null"}|${a.questionId}|${a.chosen}`;
    const prev = lastSeen.get(key);
    if (prev && a.createdAt.getTime() - prev.createdAt.getTime() <= WINDOW_MS) {
      // duplicate within window — drop this one, keep `prev`
      toDelete.push(a.id);
      // keep prev's createdAt as anchor so a long burst still collapses to the first row
    } else {
      lastSeen.set(key, { id: a.id, createdAt: a.createdAt });
    }
  }

  console.log(`Duplicate rows to delete: ${toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Sample preview
  const sample = await prisma.attempt.findMany({
    where: { id: { in: toDelete.slice(0, 10) } },
    select: {
      id: true,
      userId: true,
      quizId: true,
      questionId: true,
      chosen: true,
      createdAt: true,
    },
  });
  console.log("Sample rows that would be deleted:");
  for (const r of sample) {
    console.log(
      `  id=${r.id} user=${r.userId} quiz=${r.quizId} q=${r.questionId} chosen=${r.chosen} at=${r.createdAt.toISOString()}`,
    );
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to delete.");
    return;
  }

  const CHUNK = 1000;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const ids = toDelete.slice(i, i + CHUNK);
    const res = await prisma.attempt.deleteMany({ where: { id: { in: ids } } });
    deleted += res.count;
    console.log(`Deleted ${deleted}/${toDelete.length}`);
  }
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
