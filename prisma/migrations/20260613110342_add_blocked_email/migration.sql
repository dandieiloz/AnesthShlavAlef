-- CreateTable
CREATE TABLE "BlockedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedById" TEXT,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockedEmail_email_key" ON "BlockedEmail"("email");

-- AddForeignKey
ALTER TABLE "BlockedEmail" ADD CONSTRAINT "BlockedEmail_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
