-- AlterTable
ALTER TABLE "AnswerReport" ADD COLUMN     "adminResponse" TEXT,
ADD COLUMN     "adminResponseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DebugReport" ADD COLUMN     "adminResponse" TEXT,
ADD COLUMN     "adminResponseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDailyPopupAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DailyPopup" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPopup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPopupAck" (
    "userId" TEXT NOT NULL,
    "popupId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyPopupAck_pkey" PRIMARY KEY ("userId","popupId")
);

-- CreateIndex
CREATE INDEX "DailyPopup_enabled_createdAt_idx" ON "DailyPopup"("enabled", "createdAt");

-- CreateIndex
CREATE INDEX "DailyPopupAck_userId_idx" ON "DailyPopupAck"("userId");

-- CreateIndex
CREATE INDEX "AnswerReport_userId_createdAt_idx" ON "AnswerReport"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DailyPopupAck" ADD CONSTRAINT "DailyPopupAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPopupAck" ADD CONSTRAINT "DailyPopupAck_popupId_fkey" FOREIGN KEY ("popupId") REFERENCES "DailyPopup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
