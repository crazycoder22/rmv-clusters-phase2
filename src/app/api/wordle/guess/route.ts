import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, getDailyWord, isValidGuess, evaluateGuess } from "@/lib/wordle";

const MAX_ATTEMPTS = 6;

export async function POST(request: Request) {
  const body = await request.json();
  const { playerId, guess } = body;

  if (!playerId || !guess) {
    return NextResponse.json({ error: "playerId and guess required" }, { status: 400 });
  }

  const word = guess.trim().toLowerCase();

  if (word.length !== 5) {
    return NextResponse.json({ error: "Guess must be 5 letters" }, { status: 400 });
  }

  if (!isValidGuess(word)) {
    return NextResponse.json({ error: "Not a valid word" }, { status: 400 });
  }

  // Verify player exists
  const player = await prisma.wordlePlayer.findUnique({ where: { id: playerId } });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const today = getTodayIST();
  const answer = getDailyWord(today);

  // Get or create game
  let game = await prisma.wordleGame.findUnique({
    where: { playerId_date: { playerId, date: today } },
  });

  if (game?.completed) {
    return NextResponse.json({ error: "Game already completed for today" }, { status: 400 });
  }

  const existingGuesses: string[] = game ? JSON.parse(game.guesses) : [];

  if (existingGuesses.length >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "No attempts remaining" }, { status: 400 });
  }

  // Check for duplicate guess
  if (existingGuesses.includes(word)) {
    return NextResponse.json({ error: "Already guessed this word" }, { status: 400 });
  }

  const feedback = evaluateGuess(word, answer);
  const won = word === answer;
  const newGuesses = [...existingGuesses, word];
  const completed = won || newGuesses.length >= MAX_ATTEMPTS;

  if (game) {
    game = await prisma.wordleGame.update({
      where: { id: game.id },
      data: {
        guesses: JSON.stringify(newGuesses),
        attempts: newGuesses.length,
        won,
        completed,
      },
    });
  } else {
    game = await prisma.wordleGame.create({
      data: {
        playerId,
        date: today,
        guesses: JSON.stringify(newGuesses),
        attempts: 1,
        won,
        completed,
      },
    });
  }

  // Return all guesses with feedback
  const allGuesses = newGuesses.map((w) => ({
    word: w,
    feedback: evaluateGuess(w, answer),
  }));

  return NextResponse.json({
    feedback,
    won,
    completed,
    guesses: allGuesses,
    answer: completed && !won ? answer : undefined,
  });
}
