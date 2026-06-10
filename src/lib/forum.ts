import { db } from "@/lib/db";

/**
 * Single source of truth for forum threads and replies.
 *
 * A question's "תגובות קהילה" discussion IS a forum thread (ForumThread.questionId),
 * and each comment is a ForumReply. The same helpers back both the question pages and
 * the /forum pages, so a reply posted in one place is reflected in the other.
 */

export type ForumRole = "USER" | "ADMIN";

/** Find the forum thread for a question, creating it on first use. */
export async function getOrCreateQuestionThread(questionId: number) {
  const existing = await db.forumThread.findUnique({ where: { questionId } });
  if (existing) return existing;
  try {
    return await db.forumThread.create({ data: { questionId } });
  } catch {
    // Concurrent create — fall back to the row the other request inserted.
    const row = await db.forumThread.findUnique({ where: { questionId } });
    if (row) return row;
    throw new Error("Failed to create question thread");
  }
}

/** Create a reply on a thread and bump the thread's activity timestamp. */
export async function createReply(threadId: string, authorId: string, body: string) {
  const [reply] = await db.$transaction([
    db.forumReply.create({ data: { threadId, authorId, body } }),
    db.forumThread.update({ where: { id: threadId }, data: { lastReplyAt: new Date() } }),
  ]);
  return reply;
}

/** Add a reply to a question's discussion (creating the thread if needed). */
export async function addQuestionReply(questionId: number, authorId: string, body: string) {
  const thread = await getOrCreateQuestionThread(questionId);
  return createReply(thread.id, authorId, body);
}

/** Edit a reply. Allowed for the author or an admin; returns null when not permitted. */
export async function editReply(replyId: string, userId: string, role: ForumRole, body: string) {
  const reply = await db.forumReply.findUnique({ where: { id: replyId }, select: { authorId: true } });
  if (!reply) return null;
  if (reply.authorId !== userId && role !== "ADMIN") return null;
  return db.forumReply.update({ where: { id: replyId }, data: { body, editedAt: new Date() } });
}

/** Delete a reply. Allowed for the author or an admin; returns null when not permitted. */
export async function deleteReply(replyId: string, userId: string, role: ForumRole) {
  const reply = await db.forumReply.findUnique({
    where: { id: replyId },
    select: { authorId: true, threadId: true },
  });
  if (!reply) return null;
  if (reply.authorId !== userId && role !== "ADMIN") return null;
  await db.forumReply.delete({ where: { id: replyId } });
  return reply;
}

/** Create a free-form discussion topic (not tied to a question). */
export async function createThread(authorId: string, title: string, body: string | null) {
  return db.forumThread.create({
    data: { authorId, title, body, lastReplyAt: new Date() },
  });
}

/** Delete a thread. Allowed for the author or an admin; returns null when not permitted. */
export async function deleteThread(threadId: string, userId: string, role: ForumRole) {
  const thread = await db.forumThread.findUnique({
    where: { id: threadId },
    select: { authorId: true, questionId: true },
  });
  if (!thread) return null;
  // Question-linked threads are not deletable (they belong to the question, not a user).
  if (thread.questionId !== null) return null;
  if (thread.authorId !== userId && role !== "ADMIN") return null;
  await db.forumThread.delete({ where: { id: threadId } });
  return thread;
}
