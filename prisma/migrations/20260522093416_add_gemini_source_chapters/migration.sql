-- AlterTable
ALTER TABLE "GeminiAnswer" ADD COLUMN     "sourceChapters" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
