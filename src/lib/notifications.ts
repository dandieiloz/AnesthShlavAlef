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
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { forumLastVisitedAt: true },
  });
  const lastVisit = me?.forumLastVisitedAt ?? null;
  if (!lastVisit) return 0;

  const threads = await db.forumThread.findMany({
    where: { lastReplyAt: { gt: lastVisit } },
    select: {
      authorId: true,
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { authorId: true },
      },
    },
    take: 200,
  });

  return threads.reduce((count, th) => {
    const lastActivityAuthorId = th.replies[0]?.authorId ?? th.authorId;
    return lastActivityAuthorId !== userId ? count + 1 : count;
  }, 0);
}
