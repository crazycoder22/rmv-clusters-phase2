import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GRID_CONFIG } from "@/lib/memory";
import type { Difficulty } from "@/lib/memory";

export const dynamic = "force-dynamic";

// POST — Resolve a revealed pair. Called after the reveal animation by the
// current player. If the pair matches, that player keeps their turn; otherwise
// the turn passes to the next player. When all pairs are matched, the session
// moves to COMPLETED.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId } = await request.json();

  if (!playerId)
    return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const session = await prisma.memoryMultiSession.findUnique({
    where: { code },
    include: { players: { orderBy: { joinOrder: "asc" } } },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status !== "ACTIVE")
    return NextResponse.json({ error: "Game not active" }, { status: 400 });

  if (session.flipA === null || session.flipB === null)
    return NextResponse.json({ error: "Nothing to resolve" }, { status: 400 });

  const current = session.players[session.currentTurn];
  if (!current || current.playerId !== playerId)
    return NextResponse.json({ error: "Not your turn" }, { status: 403 });

  const cards: string[] = JSON.parse(session.cards);
  const matched: number[] = JSON.parse(session.matched);

  const a = session.flipA;
  const b = session.flipB;
  const isMatch = cards[a] === cards[b];

  if (isMatch) {
    const newMatched = [...matched, a, b];
    const difficulty = session.difficulty as Difficulty;
    const totalPairs = GRID_CONFIG[difficulty].pairs;
    const allMatched = newMatched.length / 2 >= totalPairs;

    await prisma.$transaction([
      prisma.memoryMultiPlayer.update({
        where: { id: current.id },
        data: { matches: { increment: 1 } },
      }),
      prisma.memoryMultiSession.update({
        where: { id: session.id },
        data: {
          matched: JSON.stringify(newMatched),
          flipA: null,
          flipB: null,
          status: allMatched ? "COMPLETED" : "ACTIVE",
          endedAt: allMatched ? new Date() : null,
        },
      }),
    ]);

    return NextResponse.json({
      matched: true,
      completed: allMatched,
    });
  }

  // No match — advance turn
  const nextTurn = (session.currentTurn + 1) % session.players.length;

  await prisma.memoryMultiSession.update({
    where: { id: session.id },
    data: {
      flipA: null,
      flipB: null,
      currentTurn: nextTurn,
    },
  });

  return NextResponse.json({ matched: false, nextTurn });
}
