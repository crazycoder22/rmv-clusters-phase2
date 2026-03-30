-- CreateTable
CREATE TABLE "FantasyMatch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "venue" TEXT,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FantasyPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeam" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyTeamPlayer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isViceCaptain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FantasyTeamPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FantasyScoreEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "runOuts" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FantasyMatch_status_idx" ON "FantasyMatch"("status");

-- CreateIndex
CREATE INDEX "FantasyMatch_matchDate_idx" ON "FantasyMatch"("matchDate");

-- CreateIndex
CREATE INDEX "FantasyPlayer_matchId_idx" ON "FantasyPlayer"("matchId");

-- CreateIndex
CREATE INDEX "FantasyTeam_matchId_idx" ON "FantasyTeam"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_matchId_phone_key" ON "FantasyTeam"("matchId", "phone");

-- CreateIndex
CREATE INDEX "FantasyTeamPlayer_teamId_idx" ON "FantasyTeamPlayer"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeamPlayer_teamId_playerId_key" ON "FantasyTeamPlayer"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "FantasyScoreEvent_playerId_key" ON "FantasyScoreEvent"("playerId");

-- AddForeignKey
ALTER TABLE "FantasyPlayer" ADD CONSTRAINT "FantasyPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "FantasyMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeam" ADD CONSTRAINT "FantasyTeam_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "FantasyMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeamPlayer" ADD CONSTRAINT "FantasyTeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyTeamPlayer" ADD CONSTRAINT "FantasyTeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "FantasyPlayer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FantasyScoreEvent" ADD CONSTRAINT "FantasyScoreEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "FantasyPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
