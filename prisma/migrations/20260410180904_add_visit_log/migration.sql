-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "mygateId" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorType" TEXT NOT NULL,
    "fromSource" TEXT,
    "block" INTEGER,
    "flatNumber" TEXT,
    "flatRaw" TEXT NOT NULL,
    "inTime" TIMESTAMP(3),
    "outTime" TIMESTAMP(3),
    "approvedBy" TEXT,
    "allowedByGuard" TEXT,
    "gate" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitLog_mygateId_key" ON "VisitLog"("mygateId");

-- CreateIndex
CREATE INDEX "VisitLog_visitDate_idx" ON "VisitLog"("visitDate");

-- CreateIndex
CREATE INDEX "VisitLog_block_flatNumber_idx" ON "VisitLog"("block", "flatNumber");

-- CreateIndex
CREATE INDEX "VisitLog_fromSource_idx" ON "VisitLog"("fromSource");

-- CreateIndex
CREATE INDEX "VisitLog_allowedByGuard_idx" ON "VisitLog"("allowedByGuard");

-- CreateIndex
CREATE INDEX "VisitLog_visitDate_block_flatNumber_idx" ON "VisitLog"("visitDate", "block", "flatNumber");
