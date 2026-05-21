-- AlterTable
ALTER TABLE "VehicleStickerRequest"
  ADD COLUMN "mygateRegistered"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "alreadyHasSticker" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VehicleStickerRequest_mygateRegistered_idx" ON "VehicleStickerRequest"("mygateRegistered");
