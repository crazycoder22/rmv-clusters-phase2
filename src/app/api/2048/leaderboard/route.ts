import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — 2048 leaderboard. Each player appears once with their best run.
//   scope=alltime (default) — best run ever
//   scope=weekly            — best run in the last 7 days
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "alltime";

  const where: { createdAt?: { gte: Date } } = {};
  if (scope === "weekly") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: sevenDaysAgo };
  }

  // Pull every matching run and pick the best per player in memory.
  // Volume is small (single residential community); this is simpler and
  // faster than writing a correlated subquery.
  const runs = await prisma.game2048Run.findMany({
    where,
    include: {
      player: {
        select: { id: true, name: true, block: true, flatNumber: true },
      },
    },
    orderBy: { score: "desc" },
  });

  const bestPerPlayer = new Map<
    string,
    {
      playerId: string;
      name: string;
      block: number;
      flatNumber: string;
      score: number;
      highestTile: number;
      moves: number;
      duration: number;
      won: boolean;
      createdAt: Date;
    }
  >();

  for (const r of runs) {
    if (bestPerPlayer.has(r.playerId)) continue; // runs are already ordered by score desc
    bestPerPlayer.set(r.playerId, {
      playerId: r.player.id,
      name: r.player.name,
      block: r.player.block,
      flatNumber: r.player.flatNumber,
      score: r.score,
      highestTile: r.highestTile,
      moves: r.moves,
      duration: r.duration,
      won: r.won,
      createdAt: r.createdAt,
    });
  }

  const leaderboard = Array.from(bestPerPlayer.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((p, i) => ({ rank: i + 1, ...p }));

  return NextResponse.json({ leaderboard });
}
