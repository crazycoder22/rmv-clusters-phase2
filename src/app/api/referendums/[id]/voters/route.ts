import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { OWNER_TYPES, type ReferendumEligibilityValue } from "@/lib/referendums";

export const dynamic = "force-dynamic";

// GET /api/referendums/[id]/voters — committee-only turnout roster.
//
// Shows WHO has voted (and which eligible flats have NOT) for accountability
// and reminders. This does NOT reveal the choice — the ballot stores who +
// which flat + when, never the option. Ballot secrecy is fully preserved.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Only committee members can see the voter roster" }, { status: 403 });
  }
  const { id } = await params;

  const referendum = await prisma.referendum.findUnique({
    where: { id },
    select: { id: true, eligibility: true },
  });
  if (!referendum) return NextResponse.json({ error: "Referendum not found" }, { status: 404 });
  const eligibility = referendum.eligibility as ReferendumEligibilityValue;

  // Flats that HAVE voted (with the resident who submitted + when).
  const ballots = await prisma.referendumBallot.findMany({
    where: { referendumId: id },
    orderBy: { createdAt: "asc" },
    include: { resident: { select: { name: true } } },
  });
  const votedFlatKeys = new Set(ballots.map((b) => `${b.block}|${b.flatNumber}`));

  // All eligible flats (approved residents matching eligibility), grouped.
  const eligibleResidents = await prisma.resident.findMany({
    where: {
      isApproved: true,
      ...(eligibility === "OWNERS_ONLY" ? { residentType: { in: [...OWNER_TYPES] } } : {}),
    },
    select: { name: true, block: true, flatNumber: true },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  // Pending = eligible flats with no ballot. Collapse residents into one row/flat.
  const pendingMap = new Map<string, { block: number; flatNumber: string; residents: string[] }>();
  for (const r of eligibleResidents) {
    const key = `${r.block}|${r.flatNumber}`;
    if (votedFlatKeys.has(key)) continue;
    const existing = pendingMap.get(key);
    if (existing) existing.residents.push(r.name);
    else pendingMap.set(key, { block: r.block, flatNumber: r.flatNumber, residents: [r.name] });
  }

  return NextResponse.json({
    voted: ballots.map((b) => ({
      name: b.resident.name,
      block: b.block,
      flatNumber: b.flatNumber,
      votedAt: b.createdAt.toISOString(),
    })),
    pending: Array.from(pendingMap.values()),
    votedCount: ballots.length,
    pendingCount: pendingMap.size,
  });
}
