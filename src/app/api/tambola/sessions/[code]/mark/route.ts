import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST — Mark a number on the player's ticket
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, number } = await request.json();

  if (!playerId || typeof number !== "number") {
    return NextResponse.json(
      { error: "playerId and number are required" },
      { status: 400 }
    );
  }

  const session = await prisma.tambolaSession.findUnique({
    where: { code },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Verify the number has been drawn
  const drawnNumbers: number[] = JSON.parse(session.drawnNumbers);
  if (!drawnNumbers.includes(number)) {
    return NextResponse.json(
      { error: "Number has not been drawn yet" },
      { status: 400 }
    );
  }

  // Get player's ticket
  const ticketRecord = await prisma.tambolaTicket.findUnique({
    where: { sessionId_playerId: { sessionId: session.id, playerId } },
  });
  if (!ticketRecord) {
    return NextResponse.json(
      { error: "Player has no ticket for this session" },
      { status: 404 }
    );
  }

  // Verify the number is on the player's ticket
  const ticket: number[][] = JSON.parse(ticketRecord.ticket);
  const ticketNumbers = ticket.flat().filter((n) => n !== 0);
  if (!ticketNumbers.includes(number)) {
    return NextResponse.json(
      { error: "Number is not on your ticket" },
      { status: 400 }
    );
  }

  // Append to markedNumbers (avoid duplicates)
  const markedNumbers: number[] = JSON.parse(ticketRecord.markedNumbers);
  if (!markedNumbers.includes(number)) {
    markedNumbers.push(number);
    await prisma.tambolaTicket.update({
      where: { id: ticketRecord.id },
      data: { markedNumbers: JSON.stringify(markedNumbers) },
    });
  }

  return NextResponse.json({ markedNumbers });
}
