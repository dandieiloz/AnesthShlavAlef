const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const q = await p.$queryRawUnsafe(
    `SELECT DISTINCT source FROM "Question" WHERE source LIKE '%אלי%'`
  );
  console.log("Question.source:", q);
  const u = await p.$queryRawUnsafe(
    `SELECT DISTINCT "hospitalName" FROM "User" WHERE "hospitalName" LIKE '%אלי%'`
  );
  console.log("User.hospitalName:", u);
  const d = await p.$queryRawUnsafe(
    `SELECT DISTINCT source FROM "DemoAllowedSource" WHERE source LIKE '%אלי%'`
  );
  console.log("DemoAllowedSource.source:", d);
  await p.$disconnect();
})();
