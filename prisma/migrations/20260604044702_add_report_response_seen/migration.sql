-- AlterTable
ALTER TABLE "AnswerReport" ADD COLUMN     "adminResponseSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DebugReport" ADD COLUMN     "adminResponseSeenAt" TIMESTAMP(3);
