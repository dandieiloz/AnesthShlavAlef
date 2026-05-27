-- CreateTable
CREATE TABLE "SentenceHighlight" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "sentenceIndex" INTEGER NOT NULL,
    "colorId" INTEGER NOT NULL,
    "sentenceHash" TEXT NOT NULL,
    "sentenceText" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentenceHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SentenceHighlight_userId_createdAt_idx" ON "SentenceHighlight"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SentenceHighlight_userId_questionId_locale_idx" ON "SentenceHighlight"("userId", "questionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "SentenceHighlight_userId_questionId_locale_section_sentence_key" ON "SentenceHighlight"("userId", "questionId", "locale", "section", "sentenceIndex");

-- AddForeignKey
ALTER TABLE "SentenceHighlight" ADD CONSTRAINT "SentenceHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentenceHighlight" ADD CONSTRAINT "SentenceHighlight_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
