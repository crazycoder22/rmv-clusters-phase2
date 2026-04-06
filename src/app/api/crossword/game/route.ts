import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTodayIST, generateDailyPuzzle, isPuzzleComplete } from "@/lib/crossword";

// GET /api/crossword/game?playerId=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const player = await prisma.wordlePlayer.findUnique({ where: { id: playerId } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const today = getTodayIST();

  let game = await prisma.crosswordGame.findUnique({
    where: { playerId_date: { playerId, date: today } },
  });

  if (!game) {
    const puzzle = generateDailyPuzzle(today);

    // Strip answers from clues before storing (we keep solution separately)
    const cluesForStorage = puzzle.clues.map(({ answer, ...rest }) => rest);

    game = await prisma.crosswordGame.create({
      data: {
        playerId,
        date: today,
        puzzle: JSON.stringify({
          clues: puzzle.clues, // keep full clues with answers in puzzle JSON
          cellNumbers: puzzle.cellNumbers,
          grid: puzzle.grid,
        }),
        solution: JSON.stringify(puzzle.solution),
        currentGrid: JSON.stringify(puzzle.grid),
      },
    });
  }

  const puzzleData = JSON.parse(game.puzzle);
  const solution = game.completed ? JSON.parse(game.solution) : null;

  // Strip answers from clues sent to client (unless completed)
  const clues = game.completed
    ? puzzleData.clues
    : puzzleData.clues.map(({ answer, ...rest }: { answer: string; [key: string]: unknown }) => rest);

  return NextResponse.json({
    id: game.id,
    grid: puzzleData.grid,
    cellNumbers: puzzleData.cellNumbers,
    clues,
    currentGrid: JSON.parse(game.currentGrid),
    solution,
    completed: game.completed,
    timeSeconds: game.timeSeconds,
    date: today,
  });
}

// POST /api/crossword/game — save progress or complete
export async function POST(request: Request) {
  const body = await request.json();
  const { playerId, currentGrid, timeSeconds } = body;

  if (!playerId || !currentGrid) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const today = getTodayIST();

  const game = await prisma.crosswordGame.findUnique({
    where: { playerId_date: { playerId, date: today } },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  if (game.completed) {
    const puzzleData = JSON.parse(game.puzzle);
    return NextResponse.json({
      completed: true,
      timeSeconds: game.timeSeconds,
      solution: JSON.parse(game.solution),
      clues: puzzleData.clues,
    });
  }

  const solution = JSON.parse(game.solution) as string[][];
  const completed = isPuzzleComplete(currentGrid, solution);

  await prisma.crosswordGame.update({
    where: { id: game.id },
    data: {
      currentGrid: JSON.stringify(currentGrid),
      completed,
      timeSeconds: completed ? timeSeconds : game.timeSeconds,
    },
  });

  const puzzleData = JSON.parse(game.puzzle);

  return NextResponse.json({
    completed,
    timeSeconds: completed ? timeSeconds : null,
    solution: completed ? solution : null,
    clues: completed ? puzzleData.clues : null,
  });
}
