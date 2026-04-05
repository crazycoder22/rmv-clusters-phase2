import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, generateDailyPuzzle, isGridComplete } from "@/lib/sudoku";
import type { Difficulty } from "@/lib/sudoku";

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

// GET /api/sudoku/game?playerId=...&difficulty=medium
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");
  const difficulty = (searchParams.get("difficulty") ?? "medium") as Difficulty;

  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
  }

  const player = await prisma.wordlePlayer.findUnique({ where: { id: playerId } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const today = getTodayIST();

  let game = await prisma.sudokuGame.findUnique({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
  });

  if (!game) {
    const { puzzle, solution } = generateDailyPuzzle(today, difficulty);
    game = await prisma.sudokuGame.create({
      data: {
        playerId,
        date: today,
        difficulty,
        puzzle: JSON.stringify(puzzle),
        solution: JSON.stringify(solution),
        currentGrid: JSON.stringify(puzzle),
      },
    });
  }

  return NextResponse.json({
    id: game.id,
    puzzle: JSON.parse(game.puzzle) as number[],
    solution: game.completed ? (JSON.parse(game.solution) as number[]) : null,
    currentGrid: JSON.parse(game.currentGrid) as number[],
    completed: game.completed,
    timeSeconds: game.timeSeconds,
    date: today,
    difficulty,
  });
}

// POST /api/sudoku/game — save progress or complete
export async function POST(request: Request) {
  const body = await request.json();
  const { playerId, difficulty, currentGrid, timeSeconds } = body;

  if (!playerId || !difficulty || !currentGrid) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const today = getTodayIST();

  const game = await prisma.sudokuGame.findUnique({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (game.completed) {
    return NextResponse.json({
      completed: true,
      timeSeconds: game.timeSeconds,
      solution: JSON.parse(game.solution) as number[],
    });
  }

  const solution = JSON.parse(game.solution) as number[];
  const grid: number[] = currentGrid;
  const completed = isGridComplete(grid, solution);

  await prisma.sudokuGame.update({
    where: { id: game.id },
    data: {
      currentGrid: JSON.stringify(grid),
      completed,
      timeSeconds: completed ? timeSeconds : game.timeSeconds,
    },
  });

  return NextResponse.json({
    completed,
    timeSeconds: completed ? timeSeconds : null,
    solution: completed ? solution : null,
  });
}
