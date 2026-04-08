import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicket } from "@/lib/tambola";

export const dynamic = "force-dynamic";

// POST — Join a Tambola session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId } = await request.json();

  if (!playerId) {
    return NextResponse.json(
      { error: "playerId is required" },
      { status: 400 }
    );
  }

  // Verify player exists
  const player = await prisma.wordlePlayer.findUnique({
    where: { id: playerId },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Verify session exists and is joinable
  const session = await prisma.tambolaSession.findUnique({
    where: { code },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "WAITING" && session.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Session is not accepting players" },
      { status: 400 }
    );
  }

  // Check if ticket already exists — return existing
  const existing = await prisma.tambolaTicket.findUnique({
    where: { sessionId_playerId: { sessionId: session.id, playerId } },
  });
  if (existing) {
    return NextResponse.json({
      ticketId: existing.id,
      ticket: JSON.parse(existing.ticket),
      playerId,
    });
  }

  // Generate and create ticket
  const ticketGrid = generateTicket(session.id, playerId);
  const ticket = await prisma.tambolaTicket.create({
    data: {
      sessionId: session.id,
      playerId,
      ticket: JSON.stringify(ticketGrid),
    },
  });

  return NextResponse.json({
    ticketId: ticket.id,
    ticket: ticketGrid,
    playerId,
  });
}
