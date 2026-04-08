import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePrize, type PrizeType } from "@/lib/tambola";

export const dynamic = "force-dynamic";

const VALID_PRIZE_TYPES: PrizeType[] = [
  "EARLY_FIVE",
  "TOP_LINE",
  "MIDDLE_LINE",
  "BOTTOM_LINE",
  "FULL_HOUSE",
];

// POST — Claim a prize
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, prizeType } = await request.json();

  if (!playerId || !prizeType) {
    return NextResponse.json(
      { error: "playerId and prizeType are required" },
      { status: 400 }
    );
  }
  if (!VALID_PRIZE_TYPES.includes(prizeType)) {
    return NextResponse.json(
      { error: "Invalid prize type" },
      { status: 400 }
    );
  }

  const session = await prisma.tambolaSession.findUnique({
    where: { code },
    include: { prizes: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Session is not active" },
      { status: 400 }
    );
  }

  // Check if prize already claimed
  const existingPrize = session.prizes.find((p) => p.prizeType === prizeType);
  if (existingPrize) {
    return NextResponse.json(
      { error: "Prize already claimed" },
      { status: 409 }
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

  const ticket: number[][] = JSON.parse(ticketRecord.ticket);
  const drawnNumbers: number[] = JSON.parse(session.drawnNumbers);

  // Server-side validation
  const isValid = validatePrize(prizeType as PrizeType, ticket, drawnNumbers);
  if (!isValid) {
    return NextResponse.json(
      { error: "Prize claim is not valid" },
      { status: 400 }
    );
  }

  // Create the prize (unique constraint prevents double-claim at DB level)
  try {
    await prisma.tambolaPrize.create({
      data: {
        sessionId: session.id,
        prizeType,
        playerId,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Prize already claimed" },
      { status: 409 }
    );
  }

  // Check if all 5 prizes are now claimed -> complete the session
  const totalPrizes = session.prizes.length + 1; // existing + the one we just created
  if (totalPrizes >= 5) {
    await prisma.tambolaSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ success: true, prizeType });
}
