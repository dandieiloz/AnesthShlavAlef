-- CreateEnum
CREATE TYPE "DebugReportKind" AS ENUM ('BUG', 'FEEDBACK', 'TECHNICAL');

-- CreateTable
CREATE TABLE "DebugReport" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "DebugReportKind" NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "chapterNumber" INTEGER,
    "questionId" INTEGER,
    "pageUrl" TEXT,
    "contactEmail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DebugReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebugReport_status_createdAt_idx" ON "DebugReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DebugReport_userId_createdAt_idx" ON "DebugReport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DebugReport" ADD CONSTRAINT "DebugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugReport" ADD CONSTRAINT "DebugReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugReport" ADD CONSTRAINT "DebugReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
