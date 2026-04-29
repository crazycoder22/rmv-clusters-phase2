import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST } from "@/lib/anagram";

export const dynamic = "force-dynamic";

// GET /api/anagram/leaderboard?scope=daily|weekly
//   daily  → today's run scores (default)
//   weekly → sum of daily scores for the current Mon→Sun week (IST)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "daily";

  if (scope === "weekly") {
    const today = getTodayIST();
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const day = date.getUTCDay(); // Sun=0
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() + offsetToMon);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const fmt = (x: Date) => x.toISOString().split("T")[0];
    const monStr = fmt(monday);
    const sunStr = fmt(sunday);

    const games = await prisma.anagramGame.findMany({
      where: { date: { gte: monStr, lte: sunStr }, score: { gt: 0 } },
      include: {
        player: {
          select: { id: true, name: true, block: true, flatNumber: true },
        },
      },
    });

    const byPlayer = new Map<
      string,
      {
        playerId: string;
        name: string;
        block: number;
        flatNumber: string;
        totalScore: number;
        daysPlayed: number;
      }
    >();
    for (const g of games) {
      const key = g.playerId;
      const cur = byPlayer.get(key);
      if (cur) {
        cur.totalScore += g.score;
        cur.daysPlayed++;
      } else {
        byPlayer.set(key, {
          playerId: g.player.id,
          name: g.player.name,
          block: g.player.block,
          flatNumber: g.player.flatNumber,
          totalScore: g.score,
          daysPlayed: 1,
        });
      }
    }

    const leaderboard = Array.from(byPlayer.values())
      .sort(
        (a, b) =>
          b.totalScore - a.totalScore || b.daysPlayed - a.daysPlayed
      )
      .slice(0, 20)
      .map((p, i) => ({ rank: i + 1, ...p }));

    return NextResponse.json({
      leaderboard,
      weekStart: monStr,
      weekEnd: sunStr,
    });
  }

  // Daily leaderboard
  const today = getTodayIST();
  const games = await prisma.anagramGame.findMany({
    where: { date: today, score: { gt: 0 } },
    include: {
      player: {
        select: { id: true, name: true, block: true, flatNumber: true },
      },
    },
    orderBy: { score: "desc" },
    take: 50,
  });

  const leaderboard = games.slice(0, 20).map((g, i) => ({
    rank: i + 1,
    playerId: g.player.id,
    name: g.player.name,
    block: g.player.block,
    flatNumber: g.player.flatNumber,
    score: g.score,
    wordsFound: (JSON.parse(g.foundWords) as string[]).length,
  }));

  return NextResponse.json({ leaderboard, date: today });
}
