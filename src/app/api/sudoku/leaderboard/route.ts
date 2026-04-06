import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST } from "@/lib/sudoku";
import { formatTime } from "@/lib/sudoku";

// GET /api/sudoku/leaderboard?difficulty=medium&date=2026-04-05&format=csv
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const difficulty = searchParams.get("difficulty") ?? "medium";
  const date = searchParams.get("date") ?? getTodayIST();
  const format = searchParams.get("format");
  const all = searchParams.get("all") === "true";

  const games = await prisma.sudokuGame.findMany({
    where: {
      completed: true,
      timeSeconds: { not: null },
      ...(all ? {} : { date, difficulty }),
    },
    select: {
      playerId: true,
      timeSeconds: true,
      date: true,
      difficulty: true,
      player: { select: { name: true, block: true, flatNumber: true } },
    },
    orderBy: { timeSeconds: "asc" },
    ...(all ? {} : { take: 20 }),
  });

  const leaderboard = games.map((g, i) => ({
    rank: i + 1,
    playerId: g.playerId,
    name: g.player.name,
    block: g.player.block,
    flatNumber: g.player.flatNumber,
    timeSeconds: g.timeSeconds!,
    date: g.date,
    difficulty: g.difficulty,
  }));

  if (format === "csv") {
    const header = all
      ? "Rank,Date,Difficulty,Name,Block,Flat,Time,Seconds"
      : "Rank,Name,Block,Flat,Time,Seconds";
    const rows = leaderboard.map((e, i) =>
      all
        ? `${i + 1},${e.date},${e.difficulty},"${e.name}",${e.block},"${e.flatNumber}",${formatTime(e.timeSeconds)},${e.timeSeconds}`
        : `${i + 1},"${e.name}",${e.block},"${e.flatNumber}",${formatTime(e.timeSeconds)},${e.timeSeconds}`
    );
    const csv = [header, ...rows].join("\n");
    const filename = all ? "sudoku-all-results.csv" : `sudoku-${difficulty}-${date}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ leaderboard, date, difficulty });
}
