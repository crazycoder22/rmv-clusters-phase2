-- AlterTable
ALTER TABLE "PollVote" ADD COLUMN     "guestBlock" INTEGER,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestFlat" TEXT,
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ALTER COLUMN "residentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PollVote_guestEmail_idx" ON "PollVote"("guestEmail");
