import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getDailyPuzzle,
  getMaxScore,
  getRankFromPercent,
  getTodayIST,
} from "@/lib/anagram";

export const dynamic = "force-dynamic";

// GET /api/anagram/game?playerId=X — fetch (or auto-create) today's run.
// Returns the puzzle (letters + required), the player's found words and
// score so far, plus the puzzle's max score for ranking.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");
  if (!playerId) {
    return NextResponse.json(
      { error: "playerId required" },
      { status: 400 }
    );
  }

  const today = getTodayIST();
  const { letters, required } = getDailyPuzzle(today);

  let game = await prisma.anagramGame.findUnique({
    where: { playerId_date: { playerId, date: today } },
  });

  if (!game) {
    game = await prisma.anagramGame.create({
      data: {
        playerId,
        date: today,
        letters: letters.join(""),
        required,
      },
    });
  }

  const foundWords: string[] = JSON.parse(game.foundWords);
  const maxScore = getMaxScore(letters, required);
  const pct = maxScore > 0 ? Math.round((game.score / maxScore) * 100) : 0;

  return NextResponse.json({
    date: today,
    letters,
    required,
    foundWords,
    score: game.score,
    maxScore,
    rank: getRankFromPercent(pct),
    pct,
  });
}
