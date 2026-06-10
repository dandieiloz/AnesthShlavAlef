-- Forum feature: ForumThread + ForumReply become the single source of truth for
-- question discussions ("תגובות קהילה"). Existing Comment rows are migrated into
-- a question-linked thread (one per question) plus one reply per comment, BEFORE the
-- legacy Comment table is dropped.

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "authorId" TEXT,
    "questionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastReplyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForumThread_questionId_key" ON "ForumThread"("questionId");

-- CreateIndex
CREATE INDEX "ForumThread_lastReplyAt_idx" ON "ForumThread"("lastReplyAt");

-- CreateIndex
CREATE INDEX "ForumReply_threadId_createdAt_idx" ON "ForumReply"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Data migration: existing comments → question-linked threads + replies ──

-- One thread per question that has at least one comment.
INSERT INTO "ForumThread" ("id", "questionId", "createdAt", "updatedAt", "lastReplyAt")
SELECT
    gen_random_uuid()::text,
    c."questionId",
    MIN(c."createdAt"),
    NOW(),
    MAX(c."createdAt")
FROM "Comment" c
GROUP BY c."questionId";

-- Each comment becomes a reply on its question's thread.
INSERT INTO "ForumReply" ("id", "threadId", "authorId", "body", "createdAt", "editedAt")
SELECT
    gen_random_uuid()::text,
    ft."id",
    c."userId",
    c."body",
    c."createdAt",
    c."editedAt"
FROM "Comment" c
JOIN "ForumThread" ft ON ft."questionId" = c."questionId";

-- ── Drop the legacy Comment table (data preserved above) ──

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_questionId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_userId_fkey";

-- DropTable
DROP TABLE "Comment";
