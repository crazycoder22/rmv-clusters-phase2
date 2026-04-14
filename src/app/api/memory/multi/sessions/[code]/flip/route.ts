import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — Current player flips a card. Allowed only when it's their turn and
// the game is ACTIVE. Does not advance turn; client calls /resolve once the
// reveal animation completes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, cardIdx } = await request.json();

  if (!playerId || cardIdx === undefined || cardIdx === null)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const session = await prisma.memoryMultiSession.findUnique({
    where: { code },
    include: { players: { orderBy: { joinOrder: "asc" } } },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status !== "ACTIVE")
    return NextResponse.json({ error: "Game not active" }, { status: 400 });

  const current = session.players[session.currentTurn];
  if (!current || current.playerId !== playerId)
    return NextResponse.json({ error: "Not your turn" }, { status: 403 });

  const cards: string[] = JSON.parse(session.cards);
  const matched: number[] = JSON.parse(session.matched);

  if (cardIdx < 0 || cardIdx >= cards.length)
    return NextResponse.json({ error: "Invalid card index" }, { status: 400 });

  if (matched.includes(cardIdx))
    return NextResponse.json({ error: "Card already matched" }, { status: 400 });

  if (session.flipA === cardIdx || session.flipB === cardIdx)
    return NextResponse.json({ error: "Card already flipped" }, { status: 400 });

  // If two cards are already revealed, reject — client must call /resolve first.
  if (session.flipA !== null && session.flipB !== null)
    return NextResponse.json({ error: "Resolve previous reveal first" }, { status: 400 });

  let updateData: { flipA?: number; flipB?: number } = {};
  if (session.flipA === null) {
    updateData = { flipA: cardIdx };
  } else {
    updateData = { flipB: cardIdx };
  }

  await prisma.memoryMultiSession.update({
    where: { id: session.id },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}
