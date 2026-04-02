import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const players = await prisma.wordlePlayer.findMany({
    select: {
      id: true,
      name: true,
      block: true,
      flatNumber: true,
      games: {
        where: { won: true },
        select: { id: true },
      },
      _count: {
        select: { games: true },
      },
    },
  });

  const leaderboard = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      block: p.block,
      flatNumber: p.flatNumber,
      totalWins: p.games.length,
      totalPlayed: p._count.games,
    }))
    .filter((p) => p.totalPlayed > 0)
    .sort((a, b) => b.totalWins - a.totalWins || a.totalPlayed - b.totalPlayed);

  return NextResponse.json({ leaderboard });
}
