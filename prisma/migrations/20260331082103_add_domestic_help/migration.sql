-- CreateTable
CREATE TABLE "DomesticHelp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "categories" TEXT[],
    "description" TEXT,
    "availability" TEXT,
    "addedById" TEXT NOT NULL,
    "avgRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomesticHelp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticHelpReview" (
    "id" TEXT NOT NULL,
    "domesticHelpId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomesticHelpReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomesticHelp_addedById_idx" ON "DomesticHelp"("addedById");

-- CreateIndex
CREATE INDEX "DomesticHelp_avgRating_idx" ON "DomesticHelp"("avgRating");

-- CreateIndex
CREATE INDEX "DomesticHelpReview_domesticHelpId_idx" ON "DomesticHelpReview"("domesticHelpId");

-- CreateIndex
CREATE INDEX "DomesticHelpReview_residentId_idx" ON "DomesticHelpReview"("residentId");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticHelpReview_domesticHelpId_residentId_key" ON "DomesticHelpReview"("domesticHelpId", "residentId");

-- AddForeignKey
ALTER TABLE "DomesticHelp" ADD CONSTRAINT "DomesticHelp_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticHelpReview" ADD CONSTRAINT "DomesticHelpReview_domesticHelpId_fkey" FOREIGN KEY ("domesticHelpId") REFERENCES "DomesticHelp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticHelpReview" ADD CONSTRAINT "DomesticHelpReview_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
