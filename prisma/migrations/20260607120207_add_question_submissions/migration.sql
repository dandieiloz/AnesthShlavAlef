-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NEW', 'ANALYZED', 'IMPORTED', 'REJECTED');

-- CreateTable
CREATE TABLE "QuestionSubmission" (
    "id" TEXT NOT NULL,
    "rawText" TEXT,
    "fileName" TEXT,
    "extractedText" TEXT,
    "institute" TEXT NOT NULL,
    "year" INTEGER,
    "chapterHint" TEXT,
    "doctorName" TEXT,
    "submittedById" TEXT,
    "submitterEmail" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
    "analysis" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSubmission_status_createdAt_idx" ON "QuestionSubmission"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSubmission" ADD CONSTRAINT "QuestionSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
