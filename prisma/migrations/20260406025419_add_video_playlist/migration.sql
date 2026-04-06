/*
  Warnings:

  - You are about to drop the column `category` on the `Video` table. All the data in the column will be lost.
  - Added the required column `playlistId` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Video" DROP COLUMN "category",
ADD COLUMN     "playlistId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "VideoPlaylist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "VideoCategory" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_playlistId_idx" ON "Video"("playlistId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "VideoPlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
