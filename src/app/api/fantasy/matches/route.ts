import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/fantasy/matches — list all matches (public)
export async function GET() {
  const matches = await prisma.fantasyMatch.findMany({
    orderBy: { matchDate: "desc" },
    include: {
      _count: { select: { players: true, teams: true } },
    },
  });
  return NextResponse.json({ matches });
}
