-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('DEMO', 'PAID');

-- AlterTable: add plan column with default DEMO, then backfill existing users to PAID
ALTER TABLE "User" ADD COLUMN "plan" "Plan" NOT NULL DEFAULT 'DEMO';
UPDATE "User" SET "plan" = 'PAID';

-- CreateTable
CREATE TABLE "DemoAllowedSource" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoAllowedSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoAllowedSource_source_key" ON "DemoAllowedSource"("source");

-- Seed: by default allow only the official board exam + null-source questions
INSERT INTO "DemoAllowedSource" ("id", "source") VALUES
    ('seed_demo_src_official', 'מבחן שלב א'' רשמי'),
    ('seed_demo_src_null', '__NULL__');
