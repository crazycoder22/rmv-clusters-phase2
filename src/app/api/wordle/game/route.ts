import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, getDailyWord, evaluateGuess } from "@/lib/wordle";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const today = getTodayIST();

  const game = await prisma.wordleGame.findUnique({
    where: { playerId_date: { playerId, date: today } },
  });

  if (!game) {
    return NextResponse.json({
      date: today,
      guesses: [],
      won: false,
      completed: false,
    });
  }

  // Reconstruct feedback for each guess
  const answer = getDailyWord(today);
  const rawGuesses: string[] = JSON.parse(game.guesses);
  const guesses = rawGuesses.map((word) => ({
    word,
    feedback: evaluateGuess(word, answer),
  }));

  return NextResponse.json({
    date: today,
    guesses,
    won: game.won,
    completed: game.completed,
  });
}
