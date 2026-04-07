import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, generateDailyPuzzle, isValidSudoku } from "@/lib/sudoku";
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
    currentGrid: JSON.parse(game.currentGrid) as number[],
    completed: game.completed,
    timeSeconds: game.timeSeconds,
    date: today,
    difficulty,
  });
}

// POST /api/sudoku/game — save progress, submit for validation, or reset
export async function POST(request: Request) {
  const body = await request.json();
  const { playerId, difficulty, currentGrid, timeSeconds, action } = body;

  if (!playerId || !difficulty) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const today = getTodayIST();

  const game = await prisma.sudokuGame.findUnique({
    where: { playerId_date_difficulty: { playerId, date: today, difficulty } },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  // ── Reset action: restore grid to original puzzle, clear completion ──
  if (action === "reset") {
    await prisma.sudokuGame.update({
      where: { id: game.id },
      data: {
        currentGrid: game.puzzle,
        completed: false,
        timeSeconds: null,
      },
    });
    return NextResponse.json({
      currentGrid: JSON.parse(game.puzzle) as number[],
      completed: false,
      timeSeconds: null,
    });
  }

  // ── Already completed — return status ──
  if (game.completed) {
    return NextResponse.json({
      completed: true,
      timeSeconds: game.timeSeconds,
    });
  }

  if (!currentGrid) {
    return NextResponse.json({ error: "currentGrid required" }, { status: 400 });
  }

  const grid: number[] = currentGrid;

  // ── Submit action: validate as a correct Sudoku ──
  if (action === "submit") {
    const valid = isValidSudoku(grid);

    if (valid) {
      await prisma.sudokuGame.update({
        where: { id: game.id },
        data: {
          currentGrid: JSON.stringify(grid),
          completed: true,
          timeSeconds,
        },
      });
    } else {
      // Save progress but don't complete
      await prisma.sudokuGame.update({
        where: { id: game.id },
        data: { currentGrid: JSON.stringify(grid) },
      });
    }

    return NextResponse.json({
      completed: valid,
      valid,
      timeSeconds: valid ? timeSeconds : null,
    });
  }

  // ── Default: save progress (auto-save, no validation) ──
  await prisma.sudokuGame.update({
    where: { id: game.id },
    data: { currentGrid: JSON.stringify(grid) },
  });

  return NextResponse.json({ completed: false });
}
