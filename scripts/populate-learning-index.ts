import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Learning usefulness index data (null for "אין שאלות", "פרק חדש במילר 10")
const learningIndexData: (number | null)[] = [
  null, null, null, null, null, null, null, // 1-7
  48, 75, 14, 10, 5, 4, 7, 8, 9, // 8-16
  32, 9, 29, 23, 13, 17, 48, 14, 7, // 17-25
  null, // 26 - פרק חדש במילר 10
  25, 20, 18, 28, 19, 14, 17, 21, 33, 19, 9, 8, 7, 10, 15, 9, 11, 6, 16, 17, 9, // 27-47
  null, // 48
  26, 51, 39, 43, 15, 9, 16, 105, // 49-56
  null, // 57
  9, 84, 23, 5, 10, // 58-62
  null, null, // 63-64
  26, 26, // 65-66
  null, // 67
  19, 38, // 68-69
  null, null, // 70-71
  11, // 72
  null, // 73
  55, // 74
  null, // 75
  10, 18, // 76-77
  null, // 78
  7, 69, 19, // 79-81
  null, null, null, // 82-84
  null, // 85 - פרק חדש במילר 10
  null, null // 86-87
];

async function main() {
  console.log('Starting to populate learning usefulness index...');

  for (let i = 0; i < learningIndexData.length; i++) {
    const chapterNumber = i + 1;
    const indexValue = learningIndexData[i];

    try {
      await prisma.chapter.update({
        where: { number: chapterNumber },
        data: { learningUsefulnessIndex: indexValue }
      });
      console.log(`Updated chapter ${chapterNumber} with index ${indexValue ?? 'null'}`);
    } catch (error) {
      console.log(`Chapter ${chapterNumber} not found, skipping...`);
    }
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
