const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const OLD = "בית חולים אלי״ן";
  const NEW = "אסותא אשדוד על שם סמסון";
  const r = await p.$executeRawUnsafe(
    `UPDATE "Question" SET source = REPLACE(source, $1, $2) WHERE source LIKE '%' || $1 || '%'`,
    OLD,
    NEW
  );
  console.log("Question rows updated:", r);
  const verify = await p.$queryRawUnsafe(
    `SELECT DISTINCT source FROM "Question" WHERE source LIKE '%אלי%'`
  );
  console.log("Remaining:", verify);
  await p.$disconnect();
})();
