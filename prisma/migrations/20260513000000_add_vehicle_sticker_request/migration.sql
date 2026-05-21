-- CreateTable
CREATE TABLE "VehicleStickerRequest" (
    "id" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "residentName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "residentType" TEXT NOT NULL,
    "fourWheelers" INTEGER NOT NULL DEFAULT 0,
    "twoWheelers" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "stickersIssued" BOOLEAN NOT NULL DEFAULT false,
    "issuedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleStickerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleStickerRequest_block_flatNumber_key" ON "VehicleStickerRequest"("block", "flatNumber");

-- CreateIndex
CREATE INDEX "VehicleStickerRequest_stickersIssued_idx" ON "VehicleStickerRequest"("stickersIssued");
