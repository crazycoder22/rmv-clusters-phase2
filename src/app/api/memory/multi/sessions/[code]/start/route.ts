import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — Host starts the game (WAITING -> ACTIVE)
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

  if (session.createdById !== playerId)
    return NextResponse.json({ error: "Only host can start" }, { status: 403 });

  if (session.status !== "WAITING")
    return NextResponse.json({ error: "Already started" }, { status: 400 });

  if (session.players.length < 2)
    return NextResponse.json({ error: "Need at least 2 players" }, { status: 400 });

  await prisma.memoryMultiSession.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      startedAt: new Date(),
      currentTurn: 0,
    },
  });

  return NextResponse.json({ status: "ACTIVE" });
}
