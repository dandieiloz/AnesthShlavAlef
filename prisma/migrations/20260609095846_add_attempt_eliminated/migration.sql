-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "eliminated" "Choice"[] DEFAULT ARRAY[]::"Choice"[];
