-- CreateTable
CREATE TABLE "WordlePlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordlePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordleGame" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "guesses" TEXT NOT NULL DEFAULT '[]',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordleGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WordlePlayer_email_key" ON "WordlePlayer"("email");

-- CreateIndex
CREATE INDEX "WordleGame_playerId_idx" ON "WordleGame"("playerId");

-- CreateIndex
CREATE INDEX "WordleGame_date_idx" ON "WordleGame"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WordleGame_playerId_date_key" ON "WordleGame"("playerId", "date");

-- AddForeignKey
ALTER TABLE "WordleGame" ADD CONSTRAINT "WordleGame_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WordlePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
