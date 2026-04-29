-- CreateTable
CREATE TABLE "AnagramGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "letters" TEXT NOT NULL,
    "required" TEXT NOT NULL,
    "foundWords" TEXT NOT NULL DEFAULT '[]',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnagramGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnagramGame_date_idx" ON "AnagramGame"("date");

-- CreateIndex
CREATE INDEX "AnagramGame_playerId_idx" ON "AnagramGame"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AnagramGame_playerId_date_key" ON "AnagramGame"("playerId", "date");

-- AddForeignKey
ALTER TABLE "AnagramGame" ADD CONSTRAINT "AnagramGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
