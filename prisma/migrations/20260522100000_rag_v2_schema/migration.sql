-- v2 RAG pipeline schema additions
-- 1) ChapterChunk: add ingestion metadata (nullable for back-compat with v1 chunks)
ALTER TABLE "ChapterChunk"
  ADD COLUMN "sectionPath"  TEXT,
  ADD COLUMN "headingLevel" INTEGER,
  ADD COLUMN "pageStart"    INTEGER,
  ADD COLUMN "pageEnd"      INTEGER,
  ADD COLUMN "tokenCount"   INTEGER;

-- 2) Question: multi-chapter tagging + English mirror + auto-tag flag
ALTER TABLE "Question"
  ADD COLUMN "chapterIds"        INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "chapterAutoTagged" BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN "stemEn"            TEXT;

-- Backfill: existing rows preserve admin's chosen chapter as authoritative
UPDATE "Question"
SET "chapterIds"        = ARRAY["chapterId"],
    "chapterAutoTagged" = false;

CREATE INDEX "Question_chapterIds_idx" ON "Question" USING GIN ("chapterIds");

-- 3) GeminiAnswer: structured-output fields
ALTER TABLE "GeminiAnswer"
  ADD COLUMN "evidenceCitations"    JSONB,
  ADD COLUMN "confidence"           DOUBLE PRECISION,
  ADD COLUMN "escalated"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "insufficientEvidence" BOOLEAN NOT NULL DEFAULT false;

-- 4) QuestionQueryCache: dedupe repeated board questions
CREATE TABLE "QuestionQueryCache" (
  "id"           SERIAL PRIMARY KEY,
  "questionHash" TEXT      NOT NULL UNIQUE,
  "payload"      JSONB     NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hits"         INTEGER   NOT NULL DEFAULT 0
);

-- 5) RagRun: per-invocation observability
CREATE TABLE "RagRun" (
  "id"             SERIAL PRIMARY KEY,
  "questionId"     INTEGER NOT NULL,
  "model"          TEXT    NOT NULL,
  "kPrimary"       INTEGER NOT NULL,
  "kReranked"      INTEGER NOT NULL,
  "rerankerScores" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "escalated"      BOOLEAN NOT NULL DEFAULT false,
  "cacheHit"       BOOLEAN NOT NULL DEFAULT false,
  "latencyMs"      INTEGER,
  "tokensIn"       INTEGER,
  "tokensOut"      INTEGER,
  "costCents"      DOUBLE PRECISION,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RagRun_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "RagRun_questionId_createdAt_idx" ON "RagRun" ("questionId", "createdAt");
