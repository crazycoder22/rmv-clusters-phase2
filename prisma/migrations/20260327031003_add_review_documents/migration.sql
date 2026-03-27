-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "reviewDocId" TEXT;

-- CreateTable
CREATE TABLE "ReviewDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "linkedDocumentId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewComment" (
    "id" TEXT NOT NULL,
    "reviewDocumentId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "suggestedText" TEXT,
    "highlightFrom" INTEGER,
    "highlightTo" INTEGER,
    "highlightedText" TEXT,
    "parentId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewDocument_status_idx" ON "ReviewDocument"("status");

-- CreateIndex
CREATE INDEX "ReviewDocument_createdById_idx" ON "ReviewDocument"("createdById");

-- CreateIndex
CREATE INDEX "ReviewComment_reviewDocumentId_idx" ON "ReviewComment"("reviewDocumentId");

-- CreateIndex
CREATE INDEX "ReviewComment_parentId_idx" ON "ReviewComment"("parentId");

-- CreateIndex
CREATE INDEX "Notification_reviewDocId_idx" ON "Notification"("reviewDocId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reviewDocId_fkey" FOREIGN KEY ("reviewDocId") REFERENCES "ReviewDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDocument" ADD CONSTRAINT "ReviewDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDocument" ADD CONSTRAINT "ReviewDocument_linkedDocumentId_fkey" FOREIGN KEY ("linkedDocumentId") REFERENCES "DocumentFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reviewDocumentId_fkey" FOREIGN KEY ("reviewDocumentId") REFERENCES "ReviewDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReviewComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
