-- CreateTable
CREATE TABLE "SudokuGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "puzzle" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "currentGrid" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timeSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SudokuGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SudokuGame_date_difficulty_idx" ON "SudokuGame"("date", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "SudokuGame_playerId_date_difficulty_key" ON "SudokuGame"("playerId", "date", "difficulty");

-- AddForeignKey
ALTER TABLE "SudokuGame" ADD CONSTRAINT "SudokuGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
