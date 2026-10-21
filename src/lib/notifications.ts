import "server-only";
import { db } from "./db";

/** Count of admin responses to this user's reports that they have not yet acknowledged. */
export async function countUnseenAdminResponses(userId: string): Promise<number> {
  const [a, d] = await Promise.all([
    db.answerReport.count({
      where: { userId, adminResponse: { not: null }, adminResponseSeenAt: null },
    }),
    db.debugReport.count({
      where: { userId, adminResponse: { not: null }, adminResponseSeenAt: null },
    }),
  ]);
  return a + d;
}

/** Mark all of the user's currently-responded reports as seen. Idempotent. */
export async function markAdminResponsesSeen(userId: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    db.answerReport.updateMany({
      where: { userId, adminResponse: { not: null }, adminResponseSeenAt: null },
      data: { adminResponseSeenAt: now },
    }),
    db.debugReport.updateMany({
      where: { userId, adminResponse: { not: null }, adminResponseSeenAt: null },
      data: { adminResponseSeenAt: now },
    }),
  ]);
}

/**
 * Count forum threads with activity the user hasn't seen since their last
 * חדר מתמחים visit. Mirrors the per-thread "isNew" logic on the forum page:
 * the thread's most recent activity is newer than the user's last visit AND
 * that activity wasn't authored by the user themselves. Returns 0 on the
 * user's first-ever visit (no baseline yet).
 */
export async function countUnreadForumThreads(userId: string): Promise<number> {
  // Single round trip: this runs in the root layout on every page load.
  const rows = await db.$queryRaw<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM "ForumThread" t
    JOIN "User" u ON u."id" = ${userId}
    WHERE u."forumLastVisitedAt" IS NOT NULL
      AND t."lastReplyAt" > u."forumLastVisitedAt"
      AND COALESCE(
        (SELECT r."authorId" FROM "ForumReply" r WHERE r."threadId" = t."id" ORDER BY r."createdAt" DESC LIMIT 1),
        t."authorId"
      ) IS DISTINCT FROM ${userId}
  `;
  return rows[0]?.n ?? 0;
}
