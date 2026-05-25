-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('INITIAL', 'REGENERATE');

-- AlterTable
ALTER TABLE "RagRun" ALTER COLUMN "rerankerScores" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AnswerGenerationJob" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "kind" "JobKind" NOT NULL DEFAULT 'INITIAL',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "AnswerGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerGenerationJob_status_queuedAt_idx" ON "AnswerGenerationJob"("status", "queuedAt");

-- CreateIndex
CREATE INDEX "AnswerGenerationJob_questionId_idx" ON "AnswerGenerationJob"("questionId");

-- AddForeignKey
ALTER TABLE "AnswerGenerationJob" ADD CONSTRAINT "AnswerGenerationJob_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerGenerationJob" ADD CONSTRAINT "AnswerGenerationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
