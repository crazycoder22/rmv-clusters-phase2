import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQuizCode } from "@/lib/quiz";
import { getRandomCards, GRID_CONFIG } from "@/lib/memory";
import type { Difficulty } from "@/lib/memory";

export const dynamic = "force-dynamic";

// POST — Create a multi-player memory session (creator auto-joins as first player)
export async function POST(request: Request) {
  const { playerId, difficulty: rawDifficulty } = await request.json();

  if (!playerId)
    return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const difficulty = (
    ["easy", "medium", "hard"].includes(rawDifficulty)
      ? rawDifficulty
      : "medium"
  ) as Difficulty;

  const player = await prisma.wordlePlayer.findUnique({ where: { id: playerId } });
  if (!player)
    return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Generate unique 6-char code
  let code = generateQuizCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.memoryMultiSession.findUnique({ where: { code } });
    if (!existing) break;
    code = generateQuizCode();
    attempts++;
  }

  const cards = getRandomCards(code, difficulty);

  const session = await prisma.memoryMultiSession.create({
    data: {
      code,
      difficulty,
      cards: JSON.stringify(cards),
      createdById: playerId,
      players: {
        create: {
          playerId,
          joinOrder: 0,
        },
      },
    },
  });

  return NextResponse.json({
    id: session.id,
    code: session.code,
    difficulty,
    grid: GRID_CONFIG[difficulty],
  });
}

// GET — List recent WAITING/ACTIVE sessions
export async function GET() {
  const sessions = await prisma.memoryMultiSession.findMany({
    where: { status: { in: ["WAITING", "ACTIVE"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      createdBy: { select: { name: true, block: true } },
      _count: { select: { players: true } },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      code: s.code,
      difficulty: s.difficulty,
      status: s.status,
      hostName: s.createdBy.name,
      hostBlock: s.createdBy.block,
      playerCount: s._count.players,
      createdAt: s.createdAt,
    })),
  });
}
