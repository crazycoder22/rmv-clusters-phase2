import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GRID_CONFIG } from "@/lib/memory";
import type { Difficulty } from "@/lib/memory";

export const dynamic = "force-dynamic";

// GET — Polling endpoint for game state
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const session = await prisma.memoryMultiSession.findUnique({
    where: { code },
    include: {
      createdBy: { select: { id: true, name: true, block: true } },
      players: {
        orderBy: { joinOrder: "asc" },
        include: {
          player: { select: { id: true, name: true, block: true, flatNumber: true } },
        },
      },
    },
  });

  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const cards: string[] = JSON.parse(session.cards);
  const matched: number[] = JSON.parse(session.matched);
  const difficulty = session.difficulty as Difficulty;
  const grid = GRID_CONFIG[difficulty];

  // Build visible card layout: only matched + currently flipped cards reveal emoji
  const visibleCards = cards.map((emoji, i) => {
    const isMatched = matched.includes(i);
    const isFlipped = session.flipA === i || session.flipB === i;
    if (isMatched || isFlipped) {
      return { idx: i, emoji, matched: isMatched, flipped: isFlipped };
    }
    return { idx: i, emoji: null, matched: false, flipped: false };
  });

  const totalPairs = grid.pairs;
  const matchedPairs = matched.length / 2;

  return NextResponse.json({
    code: session.code,
    status: session.status,
    difficulty,
    grid,
    cards: visibleCards,
    flipA: session.flipA,
    flipB: session.flipB,
    matchedPairs,
    totalPairs,
    currentTurn: session.currentTurn,
    hostId: session.createdBy.id,
    players: session.players.map((p) => ({
      playerId: p.player.id,
      name: p.player.name,
      block: p.player.block,
      flatNumber: p.player.flatNumber,
      joinOrder: p.joinOrder,
      matches: p.matches,
    })),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    updatedAt: session.updatedAt,
  });
}
