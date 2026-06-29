-- CreateEnum
CREATE TYPE "AccountabilityDebtStatus" AS ENUM ('OWED', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "AccountabilityDebt" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AccountabilityDebtStatus" NOT NULL DEFAULT 'OWED',
    "sourceType" TEXT,
    "sourceId" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountabilityDebt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountabilityDebt_sourceType_sourceId_residentId_key" ON "AccountabilityDebt"("sourceType", "sourceId", "residentId");

-- CreateIndex
CREATE INDEX "AccountabilityDebt_residentId_idx" ON "AccountabilityDebt"("residentId");

-- CreateIndex
CREATE INDEX "AccountabilityDebt_status_idx" ON "AccountabilityDebt"("status");

-- AddForeignKey
ALTER TABLE "AccountabilityDebt" ADD CONSTRAINT "AccountabilityDebt_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
