import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import {
  validateReferendum,
  isEligible,
  isVotingOpen,
  OWNER_TYPES,
  type ReferendumEligibilityValue,
  type ReferendumStatusValue,
} from "@/lib/referendums";
import { countEligibleFlats } from "@/lib/referendum-flats";

export const dynamic = "force-dynamic";

// GET /api/referendums → list (newest first). Never returns option vote splits.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const referendums = await prisma.referendum.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true, block: true, flatNumber: true } },
      _count: { select: { ballots: true } },
    },
  });

  // My flat's ballots across these referendums (existence only — never the choice).
  const myBallots = await prisma.referendumBallot.findMany({
    where: { block: me.block, flatNumber: me.flatNumber },
    select: { referendumId: true },
  });
  const votedSet = new Set(myBallots.map((b) => b.referendumId));

  // Eligible-flat denominators (only the two that appear, computed once).
  const needsAll = referendums.some((r) => r.eligibility === "ALL_RESIDENTS");
  const needsOwners = referendums.some((r) => r.eligibility === "OWNERS_ONLY");
  const [allFlats, ownerFlats] = await Promise.all([
    needsAll ? countEligibleFlats("ALL_RESIDENTS") : Promise.resolve(0),
    needsOwners ? countEligibleFlats("OWNERS_ONLY") : Promise.resolve(0),
  ]);

  return NextResponse.json({
    canCreate: canManageAnnouncements(me.roles),
    referendums: referendums.map((r) => ({
      id: r.id,
      title: r.title,
      eligibility: r.eligibility,
      status: r.status,
      closesAt: r.closesAt.toISOString(),
      isOpen: isVotingOpen(r.status as ReferendumStatusValue, r.closesAt, now),
      iAmEligible: isEligible(me.residentType, r.eligibility as ReferendumEligibilityValue),
      myFlatVoted: votedSet.has(r.id),
      turnout: r._count.ballots,
      eligibleFlats: r.eligibility === "OWNERS_ONLY" ? ownerFlats : allFlats,
      author: r.author,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/referendums → create (committee only)
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Only committee members can create referendums" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const v = validateReferendum(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const referendum = await prisma.referendum.create({
    data: {
      authorId: me.id,
      title: v.data.title,
      body: v.data.body,
      imageUrl: v.data.imageUrl,
      eligibility: v.data.eligibility,
      closesAt: v.data.closesAt,
      options: {
        create: v.data.options.map((text, i) => ({ text, sortOrder: i })),
      },
    },
  });

  // Notify eligible residents (best-effort). ALL_RESIDENTS → broadcast (null).
  let targetIds: string[] | null = null;
  if (v.data.eligibility === "OWNERS_ONLY") {
    const owners = await prisma.resident.findMany({
      where: { isApproved: true, residentType: { in: [...OWNER_TYPES] } },
      select: { id: true },
    });
    targetIds = owners.map((o) => o.id);
  }
  sendPushToResidents(targetIds, {
    title: "🗳 New referendum",
    body: v.data.title,
    data: { type: "referendum", id: referendum.id },
  }).catch(() => {});

  return NextResponse.json({ id: referendum.id }, { status: 201 });
}
