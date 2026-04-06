-- CreateTable
CREATE TABLE "CrosswordGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "puzzle" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "currentGrid" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrosswordGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrosswordGame_date_idx" ON "CrosswordGame"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CrosswordGame_playerId_date_key" ON "CrosswordGame"("playerId", "date");

-- AddForeignKey
ALTER TABLE "CrosswordGame" ADD CONSTRAINT "CrosswordGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
