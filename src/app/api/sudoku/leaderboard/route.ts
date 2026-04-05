import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST } from "@/lib/sudoku";

// GET /api/sudoku/leaderboard?difficulty=medium&date=2026-04-05
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") ?? "medium";
  const date = searchParams.get("date") ?? getTodayIST();

  const games = await prisma.sudokuGame.findMany({
    where: { date, difficulty, completed: true, timeSeconds: { not: null } },
    select: {
      playerId: true,
      timeSeconds: true,
      player: { select: { name: true, block: true, flatNumber: true } },
    },
    orderBy: { timeSeconds: "asc" },
    take: 20,
  });

  const leaderboard = games.map((g, i) => ({
    rank: i + 1,
    playerId: g.playerId,
    name: g.player.name,
    block: g.player.block,
    flatNumber: g.player.flatNumber,
    timeSeconds: g.timeSeconds!,
  }));

  return NextResponse.json({ leaderboard, date, difficulty });
}
