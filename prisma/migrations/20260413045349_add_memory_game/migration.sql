-- CreateTable
CREATE TABLE "MemoryGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "moves" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryGame_date_difficulty_idx" ON "MemoryGame"("date", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryGame_playerId_date_difficulty_key" ON "MemoryGame"("playerId", "date", "difficulty");

-- AddForeignKey
ALTER TABLE "MemoryGame" ADD CONSTRAINT "MemoryGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
