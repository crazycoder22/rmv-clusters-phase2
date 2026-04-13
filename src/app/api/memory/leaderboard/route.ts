import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST } from "@/lib/memory";

export const dynamic = "force-dynamic";

// GET — Leaderboard (daily or weekly)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") || "medium";
  const scope = searchParams.get("scope") || "daily";

  if (scope === "daily") {
    const today = getTodayIST();
    const games = await prisma.memoryGame.findMany({
      where: { date: today, difficulty, completed: true },
      orderBy: [{ moves: "asc" }, { timeSeconds: "asc" }],
      take: 20,
      include: {
        player: { select: { id: true, name: true, block: true, flatNumber: true } },
      },
    });

    return NextResponse.json({
      leaderboard: games.map((g, i) => ({
        rank: i + 1,
        playerId: g.player.id,
        name: g.player.name,
        block: g.player.block,
        flatNumber: g.player.flatNumber,
        moves: g.moves,
        timeSeconds: g.timeSeconds,
      })),
    });
  }

  // Weekly: aggregate by player — fewest total moves, then fastest total time
  // Get games from last 7 days
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ist);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const games = await prisma.memoryGame.findMany({
    where: { date: { in: dates }, difficulty, completed: true },
    include: {
      player: { select: { id: true, name: true, block: true, flatNumber: true } },
    },
  });

  // Aggregate per player
  const playerMap = new Map<
    string,
    {
      playerId: string;
      name: string;
      block: number;
      flatNumber: string;
      totalMoves: number;
      totalTime: number;
      daysPlayed: number;
    }
  >();

  for (const g of games) {
    const existing = playerMap.get(g.playerId);
    if (existing) {
      existing.totalMoves += g.moves;
      existing.totalTime += g.timeSeconds ?? 0;
      existing.daysPlayed++;
    } else {
      playerMap.set(g.playerId, {
        playerId: g.player.id,
        name: g.player.name,
        block: g.player.block,
        flatNumber: g.player.flatNumber,
        totalMoves: g.moves,
        totalTime: g.timeSeconds ?? 0,
        daysPlayed: 1,
      });
    }
  }

  const leaderboard = Array.from(playerMap.values())
    .sort((a, b) => b.daysPlayed - a.daysPlayed || a.totalMoves - b.totalMoves || a.totalTime - b.totalTime)
    .slice(0, 20)
    .map((p, i) => ({ rank: i + 1, ...p }));

  return NextResponse.json({ leaderboard });
}
