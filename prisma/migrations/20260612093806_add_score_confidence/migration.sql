-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('CONFIDENT', 'OK', 'WEAK');

-- CreateTable
CREATE TABLE "ScoreConfidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "level" "ConfidenceLevel" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreConfidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreConfidence_userId_idx" ON "ScoreConfidence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreConfidence_userId_scoreId_key" ON "ScoreConfidence"("userId", "scoreId");

-- AddForeignKey
ALTER TABLE "ScoreConfidence" ADD CONSTRAINT "ScoreConfidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
