-- AlterTable
ALTER TABLE "GeminiAnswer" ADD COLUMN     "algorithmVersion" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "GeminiAnswerCandidate" ADD COLUMN     "algorithmVersion" INTEGER NOT NULL DEFAULT 2;
