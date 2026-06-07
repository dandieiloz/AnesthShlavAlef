-- CreateTable
CREATE TABLE "ActivityPing" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityPing_userId_createdAt_idx" ON "ActivityPing"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityPing_createdAt_idx" ON "ActivityPing"("createdAt");

-- AddForeignKey
ALTER TABLE "ActivityPing" ADD CONSTRAINT "ActivityPing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
