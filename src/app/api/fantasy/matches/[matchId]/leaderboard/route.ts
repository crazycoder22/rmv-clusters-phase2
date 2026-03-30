import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeBasePoints, applyMultiplier } from "@/lib/fantasy";

// GET /api/fantasy/matches/[matchId]/leaderboard — public leaderboard
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  const teams = await prisma.fantasyTeam.findMany({
    where: { matchId },
    include: {
      players: {
        include: {
          player: {
            include: { scoreEvent: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const leaderboard = teams.map((team) => {
    let totalPoints = 0;
    const playerBreakdown = team.players.map((tp) => {
      const score = tp.player.scoreEvent;
      const base = score ? computeBasePoints(score) : 0;
      const points = applyMultiplier(base, tp.isCaptain, tp.isViceCaptain);
      totalPoints += points;
      return {
        playerId: tp.playerId,
        name: tp.player.name,
        role: tp.player.role,
        isCaptain: tp.isCaptain,
        isViceCaptain: tp.isViceCaptain,
        basePoints: base,
        points,
        score: score
          ? {
              runs: score.runs,
              wickets: score.wickets,
              catches: score.catches,
              runOuts: score.runOuts,
              stumpings: score.stumpings,
            }
          : null,
      };
    });

    return {
      teamId: team.id,
      name: team.name,
      phone: team.phone,
      block: team.block,
      flatNumber: team.flatNumber,
      frozen: team.frozen,
      totalPoints,
      players: playerBreakdown,
    };
  });

  // Sort by points desc, then by name asc for ties
  leaderboard.sort((a, b) =>
    b.totalPoints !== a.totalPoints
      ? b.totalPoints - a.totalPoints
      : a.name.localeCompare(b.name)
  );

  // Add rank
  const ranked = leaderboard.map((entry, i) => ({ rank: i + 1, ...entry }));

  return NextResponse.json({ leaderboard: ranked });
}
