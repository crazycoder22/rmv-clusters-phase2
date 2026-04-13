import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — Join a quiz session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId } = await request.json();

  if (!playerId)
    return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const session = await prisma.quizSession.findUnique({ where: { code } });
  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (session.status === "COMPLETED")
    return NextResponse.json({ error: "Session has ended" }, { status: 400 });

  // Verify player exists
  const player = await prisma.wordlePlayer.findUnique({
    where: { id: playerId },
  });
  if (!player)
    return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Upsert to avoid duplicate join errors
  const quizPlayer = await prisma.quizPlayer.upsert({
    where: {
      sessionId_playerId: { sessionId: session.id, playerId },
    },
    create: {
      sessionId: session.id,
      playerId,
    },
    update: {},
  });

  return NextResponse.json({
    id: quizPlayer.id,
    joined: true,
    playerName: player.name,
  });
}
