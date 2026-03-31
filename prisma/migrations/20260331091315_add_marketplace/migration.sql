-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "marketplaceListingId" TEXT;

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "category" TEXT NOT NULL,
    "listingType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rentPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "whatsappNumber" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceWishlist" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCategorySubscription" (
    "id" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCategorySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_idx" ON "MarketplaceListing"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_category_idx" ON "MarketplaceListing"("category");

-- CreateIndex
CREATE INDEX "MarketplaceListing_listingType_idx" ON "MarketplaceListing"("listingType");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_idx" ON "MarketplaceListing"("status");

-- CreateIndex
CREATE INDEX "MarketplaceListing_createdAt_idx" ON "MarketplaceListing"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceWishlist_listingId_idx" ON "MarketplaceWishlist"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceWishlist_residentId_idx" ON "MarketplaceWishlist"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceWishlist_listingId_residentId_key" ON "MarketplaceWishlist"("listingId", "residentId");

-- CreateIndex
CREATE INDEX "MarketplaceCategorySubscription_category_idx" ON "MarketplaceCategorySubscription"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCategorySubscription_residentId_category_key" ON "MarketplaceCategorySubscription"("residentId", "category");

-- CreateIndex
CREATE INDEX "Notification_marketplaceListingId_idx" ON "Notification"("marketplaceListingId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_marketplaceListingId_fkey" FOREIGN KEY ("marketplaceListingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceWishlist" ADD CONSTRAINT "MarketplaceWishlist_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketplaceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceWishlist" ADD CONSTRAINT "MarketplaceWishlist_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCategorySubscription" ADD CONSTRAINT "MarketplaceCategorySubscription_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
