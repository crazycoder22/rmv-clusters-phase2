-- AlterTable
ALTER TABLE "PublicEvent"
  ADD COLUMN "contributionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maxContribution" INTEGER,
  ADD COLUMN "targetAmount" INTEGER,
  ADD COLUMN "paymentInstructions" TEXT,
  ADD COLUMN "paymentQrImageUrl" TEXT,
  ADD COLUMN "upiId" TEXT;

-- AlterTable
ALTER TABLE "PublicEventRegistration"
  ADD COLUMN "contributionAmount" INTEGER,
  ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "adminNote" TEXT;
