-- CreateTable
CREATE TABLE "GeminiAnswerCandidate" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "jobId" INTEGER,
    "rawMarkdown" TEXT NOT NULL,
    "correctAnswer" "Choice" NOT NULL,
    "evidence" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "whyOthersWrong" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sourceChapters" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "evidenceCitations" JSONB,
    "confidence" DOUBLE PRECISION,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "insufficientEvidence" BOOLEAN NOT NULL DEFAULT false,
    "derivedChapterIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "primaryChapterId" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeminiAnswerCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeminiAnswerCandidate_questionId_key" ON "GeminiAnswerCandidate"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GeminiAnswerCandidate_jobId_key" ON "GeminiAnswerCandidate"("jobId");

-- AddForeignKey
ALTER TABLE "GeminiAnswerCandidate" ADD CONSTRAINT "GeminiAnswerCandidate_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeminiAnswerCandidate" ADD CONSTRAINT "GeminiAnswerCandidate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnswerGenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
