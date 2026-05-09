-- AlterTable
ALTER TABLE "PublicEvent" ADD COLUMN "requireEmail" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PublicEventRegistration" ADD COLUMN "email" TEXT;
