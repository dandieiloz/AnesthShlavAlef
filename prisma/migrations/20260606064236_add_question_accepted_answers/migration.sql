-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "acceptedAnswers" "Choice"[] DEFAULT ARRAY[]::"Choice"[];
