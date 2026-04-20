import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTodayIST,
  getCurrentWeekBounds,
  calculateScore,
  ACTIVE_DIFFICULTY,
} from "@/lib/memory";

export const dynamic = "force-dynamic";

// GET — Leaderboard (daily or weekly)
//   ?scope=daily|weekly        (default: daily)
//   ?difficulty=easy|medium|hard  (default: hard — the only one exposed in
//                                  the new UI; older difficulties retained
//                                  for historical record viewing)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") || ACTIVE_DIFFICULTY;
  const scope = searchParams.get("scope") || "daily";

  if (scope === "daily") {
    const today = getTodayIST();
    const games = await prisma.memoryGame.findMany({
      where: { date: today, difficulty, completed: true },
      take: 50,
      include: {
        player: { select: { id: true, name: true, block: true, flatNumber: true } },
      },
    });

    const leaderboard = games
      .map((g) => ({
        playerId: g.player.id,
        name: g.player.name,
        block: g.player.block,
        flatNumber: g.player.flatNumber,
        moves: g.moves,
        timeSeconds: g.timeSeconds,
        score: calculateScore(g.moves, g.timeSeconds ?? 0, difficulty),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((p, i) => ({ rank: i + 1, ...p }));

    return NextResponse.json({ leaderboard, date: today, difficulty });
  }

  // Weekly leaderboard: aggregate scores across the current Mon-Sun calendar
  // week (IST). This replaced the previous rolling-7-day window so the
  // weekly challenge has a clean Monday start / Sunday end every week.
  const { monday, sunday } = getCurrentWeekBounds();

  const games = await prisma.memoryGame.findMany({
    where: {
      date: { gte: monday, lte: sunday },
      difficulty,
      completed: true,
    },
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
      totalScore: number;
      daysPlayed: number;
    }
  >();

  for (const g of games) {
    const score = calculateScore(g.moves, g.timeSeconds ?? 0, difficulty);
    const existing = playerMap.get(g.playerId);
    if (existing) {
      existing.totalMoves += g.moves;
      existing.totalTime += g.timeSeconds ?? 0;
      existing.totalScore += score;
      existing.daysPlayed++;
    } else {
      playerMap.set(g.playerId, {
        playerId: g.player.id,
        name: g.player.name,
        block: g.player.block,
        flatNumber: g.player.flatNumber,
        totalMoves: g.moves,
        totalTime: g.timeSeconds ?? 0,
        totalScore: score,
        daysPlayed: 1,
      });
    }
  }

  const leaderboard = Array.from(playerMap.values())
    .sort((a, b) => b.totalScore - a.totalScore || b.daysPlayed - a.daysPlayed)
    .slice(0, 20)
    .map((p, i) => ({ rank: i + 1, ...p }));

  return NextResponse.json({
    leaderboard,
    weekStart: monday,
    weekEnd: sunday,
    difficulty,
  });
}
