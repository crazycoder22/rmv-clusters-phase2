import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, getDailyCards } from "@/lib/memory";
import type { Difficulty } from "@/lib/memory";

export const dynamic = "force-dynamic";

// GET — Get or create today's game
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");
  const difficulty = (searchParams.get("difficulty") || "medium") as Difficulty;

  if (!playerId)
    return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const today = getTodayIST();
  const cards = getDailyCards(today, difficulty);

  const game = await prisma.memoryGame.findUnique({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
  });

  return NextResponse.json({
    date: today,
    difficulty,
    cards, // emoji layout
    completed: game?.completed ?? false,
    moves: game?.moves ?? 0,
    timeSeconds: game?.timeSeconds ?? null,
  });
}

// POST — Save completed game
export async function POST(request: Request) {
  const { playerId, difficulty, moves, timeSeconds } = await request.json();

  if (!playerId || !difficulty || !moves || !timeSeconds)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const today = getTodayIST();

  // Check if already completed
  const existing = await prisma.memoryGame.findUnique({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
  });

  if (existing?.completed)
    return NextResponse.json({ error: "Already completed" }, { status: 400 });

  const game = await prisma.memoryGame.upsert({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
    create: {
      playerId,
      date: today,
      difficulty,
      moves,
      timeSeconds,
      completed: true,
    },
    update: {
      moves,
      timeSeconds,
      completed: true,
    },
  });

  return NextResponse.json({ game });
}
