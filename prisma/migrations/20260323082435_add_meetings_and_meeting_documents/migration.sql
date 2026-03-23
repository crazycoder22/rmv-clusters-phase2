-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "momUrl" TEXT,
    "momSummary" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRsvp" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATTENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingDocument" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Meeting_creatorId_idx" ON "Meeting"("creatorId");

-- CreateIndex
CREATE INDEX "MeetingRsvp_meetingId_idx" ON "MeetingRsvp"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRsvp_meetingId_residentId_key" ON "MeetingRsvp"("meetingId", "residentId");

-- CreateIndex
CREATE INDEX "MeetingDocument_meetingId_idx" ON "MeetingDocument"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingDocument_documentId_idx" ON "MeetingDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingDocument_meetingId_documentId_key" ON "MeetingDocument"("meetingId", "documentId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRsvp" ADD CONSTRAINT "MeetingRsvp_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRsvp" ADD CONSTRAINT "MeetingRsvp_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDocument" ADD CONSTRAINT "MeetingDocument_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingDocument" ADD CONSTRAINT "MeetingDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
