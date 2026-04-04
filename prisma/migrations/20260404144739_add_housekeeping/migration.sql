-- CreateTable
CREATE TABLE "HKStaff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HKStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HKAssignment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HKAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HKFeedback" (
    "id" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "residentId" TEXT,
    "guestName" TEXT,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "guestFlat" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HKFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HKAssignment_block_month_year_idx" ON "HKAssignment"("block", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "HKAssignment_staffId_block_month_year_key" ON "HKAssignment"("staffId", "block", "month", "year");

-- CreateIndex
CREATE INDEX "HKFeedback_block_month_year_idx" ON "HKFeedback"("block", "month", "year");

-- CreateIndex
CREATE INDEX "HKFeedback_residentId_idx" ON "HKFeedback"("residentId");

-- AddForeignKey
ALTER TABLE "HKAssignment" ADD CONSTRAINT "HKAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "HKStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HKFeedback" ADD CONSTRAINT "HKFeedback_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
