import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — Join a multi-player memory session
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
    include: { players: true },
  });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status === "COMPLETED")
    return NextResponse.json({ error: "Session has ended" }, { status: 400 });

  const player = await prisma.wordlePlayer.findUnique({ where: { id: playerId } });
  if (!player)
    return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Already joined? idempotent return
  const existing = session.players.find((p) => p.playerId === playerId);
  if (existing)
    return NextResponse.json({ joined: true, joinOrder: existing.joinOrder });

  // Cap at 8 players for sanity
  if (session.players.length >= 8)
    return NextResponse.json({ error: "Session is full" }, { status: 400 });

  const nextOrder = session.players.length;

  const created = await prisma.memoryMultiPlayer.create({
    data: {
      sessionId: session.id,
      playerId,
      joinOrder: nextOrder,
    },
  });

  // Touch updatedAt so pollers pick up the new player
  await prisma.memoryMultiSession.update({
    where: { id: session.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ joined: true, joinOrder: created.joinOrder });
}
