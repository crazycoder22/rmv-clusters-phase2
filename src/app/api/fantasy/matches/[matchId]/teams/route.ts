import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TEAM_SIZE, MIN_BOWLERS, MAX_BOWLERS, MAX_BATSMEN } from "@/lib/fantasy";

// GET /api/fantasy/matches/[matchId]/teams?phone=xxx
// Retrieve a specific team by phone number (so residents can view/edit their own team)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const phone = req.nextUrl.searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ team: null });
  }

  const team = await prisma.fantasyTeam.findUnique({
    where: { matchId_phone: { matchId, phone } },
    include: {
      players: {
        include: { player: { include: { scoreEvent: true } } },
      },
    },
  });

  return NextResponse.json({ team });
}

// POST /api/fantasy/matches/[matchId]/teams — create or update team
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const body = await req.json();

  const { name, email, phone, block, flatNumber, playerIds, captainId, viceCaptainId } = body as {
    name: string;
    email?: string;
    phone: string;
    block: string;
    flatNumber: string;
    playerIds: string[];
    captainId: string;
    viceCaptainId: string;
  };

  // Basic field validation
  if (!name || !phone || !block || !flatNumber) {
    return NextResponse.json({ error: "Name, phone, block and flat number are required." }, { status: 400 });
  }
  if (!playerIds || playerIds.length !== TEAM_SIZE) {
    return NextResponse.json({ error: `Please select exactly ${TEAM_SIZE} players.` }, { status: 400 });
  }
  if (!captainId || !viceCaptainId || captainId === viceCaptainId) {
    return NextResponse.json({ error: "Select a different captain and vice-captain." }, { status: 400 });
  }
  if (!playerIds.includes(captainId) || !playerIds.includes(viceCaptainId)) {
    return NextResponse.json({ error: "Captain and vice-captain must be in your team." }, { status: 400 });
  }

  // Match must exist and be OPEN
  const match = await prisma.fantasyMatch.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "OPEN") {
    return NextResponse.json({ error: "Team selection is closed for this match." }, { status: 400 });
  }

  // Validate all players belong to this match
  const players = await prisma.fantasyPlayer.findMany({
    where: { id: { in: playerIds }, matchId },
  });
  if (players.length !== TEAM_SIZE) {
    return NextResponse.json({ error: "One or more selected players are invalid." }, { status: 400 });
  }

  // Role constraints
  const bowlerCount = players.filter((p) => p.role === "BOWLER").length;
  const batsmanCount = players.filter((p) => p.role === "BATSMAN").length;

  if (bowlerCount < MIN_BOWLERS) {
    return NextResponse.json({ error: `You must include at least ${MIN_BOWLERS} bowler.` }, { status: 400 });
  }
  if (bowlerCount > MAX_BOWLERS) {
    return NextResponse.json({ error: `You can include at most ${MAX_BOWLERS} bowlers.` }, { status: 400 });
  }
  if (batsmanCount > MAX_BATSMEN) {
    return NextResponse.json({ error: `You can include at most ${MAX_BATSMEN} batsmen.` }, { status: 400 });
  }

  // Check if this phone already has a frozen team
  const existing = await prisma.fantasyTeam.findUnique({
    where: { matchId_phone: { matchId, phone } },
  });
  if (existing?.frozen) {
    return NextResponse.json({ error: "Your team is already frozen and cannot be changed." }, { status: 400 });
  }

  // Upsert team
  const team = await prisma.fantasyTeam.upsert({
    where: { matchId_phone: { matchId, phone } },
    create: {
      matchId,
      name,
      email: email || null,
      phone,
      block,
      flatNumber,
      frozen: false,
      players: {
        create: playerIds.map((pid) => ({
          playerId: pid,
          isCaptain: pid === captainId,
          isViceCaptain: pid === viceCaptainId,
        })),
      },
    },
    update: {
      name,
      email: email || null,
      block,
      flatNumber,
      players: {
        deleteMany: {},
        create: playerIds.map((pid) => ({
          playerId: pid,
          isCaptain: pid === captainId,
          isViceCaptain: pid === viceCaptainId,
        })),
      },
    },
    include: {
      players: { include: { player: true } },
    },
  });

  return NextResponse.json({ team });
}

// PATCH /api/fantasy/matches/[matchId]/teams — freeze team
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;
  const { phone } = await req.json();

  if (!phone) return NextResponse.json({ error: "Phone required." }, { status: 400 });

  const match = await prisma.fantasyMatch.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "OPEN") {
    return NextResponse.json({ error: "Team selection is closed." }, { status: 400 });
  }

  const existing = await prisma.fantasyTeam.findUnique({
    where: { matchId_phone: { matchId, phone } },
  });
  if (!existing) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (existing.frozen) return NextResponse.json({ error: "Already frozen." }, { status: 400 });

  const updated = await prisma.fantasyTeam.update({
    where: { matchId_phone: { matchId, phone } },
    data: { frozen: true },
    include: { players: { include: { player: true } } },
  });

  return NextResponse.json({ team: updated });
}
