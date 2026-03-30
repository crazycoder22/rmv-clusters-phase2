-- DropForeignKey
ALTER TABLE "FantasyTeamPlayer" DROP CONSTRAINT "FantasyTeamPlayer_playerId_fkey";

-- AddForeignKey
ALTER TABLE "FantasyTeamPlayer" ADD CONSTRAINT "FantasyTeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "FantasyPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
