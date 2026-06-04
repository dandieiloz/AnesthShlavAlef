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
