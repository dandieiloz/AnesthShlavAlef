-- CreateTable
CREATE TABLE "QuestionAdminNote" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAdminNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionAdminNote_questionId_createdAt_idx" ON "QuestionAdminNote"("questionId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuestionAdminNote" ADD CONSTRAINT "QuestionAdminNote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAdminNote" ADD CONSTRAINT "QuestionAdminNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
