import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, formatTime } from "@/lib/crossword";

// GET /api/crossword/leaderboard?date=2026-04-06&format=csv
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? getTodayIST();
  const format = searchParams.get("format");
  const all = searchParams.get("all") === "true";

  const games = await prisma.crosswordGame.findMany({
    where: {
      completed: true,
      timeSeconds: { not: null },
      ...(all ? {} : { date }),
    },
    select: {
      playerId: true,
      timeSeconds: true,
      date: true,
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
  }));

  if (format === "csv") {
    const header = all
      ? "Rank,Date,Name,Block,Flat,Time,Seconds"
      : "Rank,Name,Block,Flat,Time,Seconds";
    const rows = leaderboard.map((e, i) =>
      all
        ? `${i + 1},${e.date},"${e.name}",${e.block},"${e.flatNumber}",${formatTime(e.timeSeconds)},${e.timeSeconds}`
        : `${i + 1},"${e.name}",${e.block},"${e.flatNumber}",${formatTime(e.timeSeconds)},${e.timeSeconds}`
    );
    const csv = [header, ...rows].join("\n");
    const filename = all ? "crossword-all-results.csv" : `crossword-${date}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ leaderboard, date });
}
