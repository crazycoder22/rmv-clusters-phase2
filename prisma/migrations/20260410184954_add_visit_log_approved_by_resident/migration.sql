-- AlterTable
ALTER TABLE "VisitLog" ADD COLUMN     "approvedByResident" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark rows as resident-approved when approvedBy is present AND
-- differs (case-insensitively) from the guard who allowed them in.
-- Rows where approvedBy equals the guard name are walk-throughs, not real
-- resident approvals.
UPDATE "VisitLog"
SET "approvedByResident" = TRUE
WHERE "approvedBy" IS NOT NULL
  AND TRIM("approvedBy") <> ''
  AND LOWER(TRIM("approvedBy")) <> LOWER(TRIM(COALESCE("allowedByGuard", '')));

-- CreateIndex
CREATE INDEX "VisitLog_visitDate_approvedByResident_idx" ON "VisitLog"("visitDate", "approvedByResident");
