-- CreateEnum
CREATE TYPE "TambolaSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TambolaPrizeType" AS ENUM ('EARLY_FIVE', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE');

-- CreateTable
CREATE TABLE "TambolaSession" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TambolaSessionStatus" NOT NULL DEFAULT 'WAITING',
    "drawnNumbers" TEXT NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TambolaSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TambolaTicket" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "markedNumbers" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TambolaTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TambolaPrize" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "prizeType" "TambolaPrizeType" NOT NULL,
    "playerId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TambolaPrize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TambolaSession_code_key" ON "TambolaSession"("code");

-- CreateIndex
CREATE INDEX "TambolaSession_status_idx" ON "TambolaSession"("status");

-- CreateIndex
CREATE INDEX "TambolaTicket_sessionId_idx" ON "TambolaTicket"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TambolaTicket_sessionId_playerId_key" ON "TambolaTicket"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "TambolaPrize_sessionId_idx" ON "TambolaPrize"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TambolaPrize_sessionId_prizeType_key" ON "TambolaPrize"("sessionId", "prizeType");

-- AddForeignKey
ALTER TABLE "TambolaSession" ADD CONSTRAINT "TambolaSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TambolaTicket" ADD CONSTRAINT "TambolaTicket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TambolaSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TambolaTicket" ADD CONSTRAINT "TambolaTicket_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TambolaPrize" ADD CONSTRAINT "TambolaPrize_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TambolaSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TambolaPrize" ADD CONSTRAINT "TambolaPrize_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
