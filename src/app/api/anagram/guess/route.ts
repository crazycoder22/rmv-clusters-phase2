import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getDailyPuzzle,
  getMaxScore,
  getRankFromPercent,
  getTodayIST,
  judgeWord,
} from "@/lib/anagram";

export const dynamic = "force-dynamic";

// POST /api/anagram/guess — submit a word. Validates against the day's
// puzzle + bundled dictionary; updates the player's run.
//
// Body: { playerId: string, word: string }
// Response (success): { ok: true, word, score, isPangram, runScore, foundWords, rank, pct }
// Response (failure): { ok: false, reason }
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    playerId?: string;
    word?: string;
  } | null;
  if (!body?.playerId || typeof body.word !== "string") {
    return NextResponse.json(
      { ok: false, reason: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const today = getTodayIST();
  const { letters, required } = getDailyPuzzle(today);

  // Ensure a row exists (idempotent).
  const game = await prisma.anagramGame.upsert({
    where: { playerId_date: { playerId: body.playerId, date: today } },
    create: {
      playerId: body.playerId,
      date: today,
      letters: letters.join(""),
      required,
    },
    update: {},
  });

  const found: string[] = JSON.parse(game.foundWords);
  const judgement = judgeWord(body.word, letters, required, new Set(found));
  if (!judgement.ok) {
    return NextResponse.json({ ok: false, reason: judgement.reason });
  }

  const word = body.word.trim().toLowerCase();
  const newFound = [...found, word];
  const newScore = game.score + judgement.score;

  await prisma.anagramGame.update({
    where: { id: game.id },
    data: {
      foundWords: JSON.stringify(newFound),
      score: newScore,
    },
  });

  const maxScore = getMaxScore(letters, required);
  const pct = maxScore > 0 ? Math.round((newScore / maxScore) * 100) : 0;

  return NextResponse.json({
    ok: true,
    word,
    score: judgement.score,
    isPangram: judgement.isPangram,
    runScore: newScore,
    foundWords: newFound,
    rank: getRankFromPercent(pct),
    pct,
    maxScore,
  });
}
