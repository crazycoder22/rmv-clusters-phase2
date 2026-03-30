import { prisma } from "../src/lib/prisma";

const MATCH_ID = "cmncz5gsw000104johalqaqxf";

async function main() {
  // 1. Get all player IDs for this match
  const players = await prisma.fantasyPlayer.findMany({
    where: { matchId: MATCH_ID },
    select: { id: true },
  });
  const playerIds = players.map((p) => p.id);

  // 2. Delete FantasyTeamPlayers referencing those players
  const tp = await prisma.fantasyTeamPlayer.deleteMany({ where: { playerId: { in: playerIds } } });
  console.log(`Deleted ${tp.count} team-player rows`);

  // 3. Delete score events
  const se = await prisma.fantasyScoreEvent.deleteMany({ where: { playerId: { in: playerIds } } });
  console.log(`Deleted ${se.count} score events`);

  // 4. Delete teams for this match
  const teams = await prisma.fantasyTeam.deleteMany({ where: { matchId: MATCH_ID } });
  console.log(`Deleted ${teams.count} teams`);

  // 5. Delete players
  const pl = await prisma.fantasyPlayer.deleteMany({ where: { matchId: MATCH_ID } });
  console.log(`Deleted ${pl.count} players`);

  // 6. Delete the match
  await prisma.fantasyMatch.delete({ where: { id: MATCH_ID } });
  console.log("✅ Match deleted successfully");

  await prisma.$disconnect();
}
main();
