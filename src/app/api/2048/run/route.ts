import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isScorePlausible, WIN_TILE } from "@/lib/game2048";

export const dynamic = "force-dynamic";

// POST — record a finished 2048 run (game over OR user abandoned). We accept
// any finished run, not just wins; the leaderboard ranks by best score.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { playerId, score, highestTile, moves, duration } = body as {
    playerId?: string;
    score?: number;
    highestTile?: number;
    moves?: number;
    duration?: number;
  };

  if (
    !playerId ||
    typeof score !== "number" ||
    typeof highestTile !== "number" ||
    typeof moves !== "number" ||
    typeof duration !== "number"
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!isScorePlausible(score, highestTile)) {
    return NextResponse.json(
      { error: "Score does not match highest tile" },
      { status: 400 }
    );
  }
  if (moves < 0 || moves > 100000 || duration < 0 || duration > 24 * 3600) {
    return NextResponse.json({ error: "Invalid run stats" }, { status: 400 });
  }

  const player = await prisma.wordlePlayer.findUnique({
    where: { id: playerId },
    select: { id: true },
  });
  if (!player)
    return NextResponse.json({ error: "Unknown player" }, { status: 404 });

  const run = await prisma.game2048Run.create({
    data: {
      playerId,
      score,
      highestTile,
      moves,
      duration,
      won: highestTile >= WIN_TILE,
    },
  });

  return NextResponse.json({ ok: true, runId: run.id });
}
