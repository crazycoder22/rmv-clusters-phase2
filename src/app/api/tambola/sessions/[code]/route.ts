import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — Game state polling endpoint
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  const session = await prisma.tambolaSession.findUnique({
    where: { code },
    include: {
      prizes: {
        include: { player: { select: { name: true } } },
      },
      _count: { select: { tickets: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const result: Record<string, unknown> = {
    id: session.id,
    code: session.code,
    title: session.title,
    status: session.status,
    drawnNumbers: JSON.parse(session.drawnNumbers),
    prizes: session.prizes.map((p) => ({
      prizeType: p.prizeType,
      playerName: p.player.name,
      claimedAt: p.claimedAt,
    })),
    playerCount: session._count.tickets,
    updatedAt: session.updatedAt,
  };

  // If playerId provided, include their ticket data
  if (playerId) {
    const ticket = await prisma.tambolaTicket.findUnique({
      where: { sessionId_playerId: { sessionId: session.id, playerId } },
    });
    if (ticket) {
      result.ticket = JSON.parse(ticket.ticket);
      result.markedNumbers = JSON.parse(ticket.markedNumbers);
    }
  }

  return NextResponse.json(result);
}
