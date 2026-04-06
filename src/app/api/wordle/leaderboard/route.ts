import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Points per win based on attempts: 1 guess = 6 pts, 2 = 5, ..., 6 = 1
function attemptsToPoints(attempts: number): number {
  return Math.max(7 - attempts, 1);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const players = await prisma.wordlePlayer.findMany({
    select: {
      id: true,
      name: true,
      block: true,
      flatNumber: true,
      games: {
        where: { completed: true },
        select: { won: true, attempts: true },
      },
    },
  });

  const leaderboard = players
    .map((p) => {
      const wins = p.games.filter((g) => g.won);
      const totalScore = wins.reduce((sum, g) => sum + attemptsToPoints(g.attempts), 0);
      const avgAttempts = wins.length > 0
        ? Math.round((wins.reduce((sum, g) => sum + g.attempts, 0) / wins.length) * 10) / 10
        : 0;

      return {
        id: p.id,
        name: p.name,
        block: p.block,
        flatNumber: p.flatNumber,
        totalWins: wins.length,
        totalPlayed: p.games.length,
        totalScore,
        avgAttempts,
      };
    })
    .filter((p) => p.totalPlayed > 0)
    .sort((a, b) => b.totalScore - a.totalScore || b.totalWins - a.totalWins || a.avgAttempts - b.avgAttempts);

  if (format === "csv") {
    const header = "Rank,Name,Block,Flat,Wins,Played,Score,Avg Attempts";
    const rows = leaderboard.map((p, i) =>
      `${i + 1},"${p.name}",${p.block},"${p.flatNumber}",${p.totalWins},${p.totalPlayed},${p.totalScore},${p.avgAttempts}`
    );
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="wordle-leaderboard.csv"`,
      },
    });
  }

  return NextResponse.json({ leaderboard });
}
