import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const chapters = await prisma.chapter.findMany({
    orderBy: { number: 'asc' },
    select: {
      number: true,
      title: true,
      learningUsefulnessIndex: true
    }
  });

  console.log('Chapters with learning usefulness index:');
  chapters.forEach(c => {
    console.log(`Chapter ${c.number}: ${c.learningUsefulnessIndex ?? 'null'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
