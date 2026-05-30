import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import {
  validateReferendum,
  isEligible,
  isVotingOpen,
  isResultVisible,
  type ReferendumEligibilityValue,
  type ReferendumStatusValue,
} from "@/lib/referendums";
import { countEligibleFlats } from "@/lib/referendum-flats";

export const dynamic = "force-dynamic";

// GET /api/referendums/[id]
// Returns option TEXT always, but vote counts ONLY once results are visible
// (closed early or deadline passed). While open: turnout only, never the split.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const now = new Date();

  const referendum = await prisma.referendum.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, block: true, flatNumber: true } },
      options: { orderBy: { sortOrder: "asc" } },
      _count: { select: { ballots: true } },
    },
  });
  if (!referendum) return NextResponse.json({ error: "Referendum not found" }, { status: 404 });

  const eligibility = referendum.eligibility as ReferendumEligibilityValue;
  const status = referendum.status as ReferendumStatusValue;
  const open = isVotingOpen(status, referendum.closesAt, now);
  const resultVisible = isResultVisible(status, referendum.closesAt, now);

  // Has MY flat already voted? (existence only — never which option.)
  const myBallot = await prisma.referendumBallot.findUnique({
    where: {
      referendumId_block_flatNumber: {
        referendumId: id,
        block: me.block,
        flatNumber: me.flatNumber,
      },
    },
    select: { id: true },
  });

  const turnout = referendum._count.ballots;
  const eligibleFlats = await countEligibleFlats(eligibility);

  // Options: always include text; include voteCount only when results are visible.
  const options = referendum.options.map((o) => ({
    id: o.id,
    text: o.text,
    sortOrder: o.sortOrder,
    ...(resultVisible ? { voteCount: o.voteCount } : {}),
  }));

  return NextResponse.json({
    id: referendum.id,
    title: referendum.title,
    body: referendum.body,
    imageUrl: referendum.imageUrl,
    eligibility,
    status,
    closesAt: referendum.closesAt.toISOString(),
    closedAt: referendum.closedAt?.toISOString() ?? null,
    isOpen: open,
    resultVisible,
    iAmEligible: isEligible(me.residentType, eligibility),
    myFlatVoted: !!myBallot,
    turnout,
    eligibleFlats,
    totalVotes: resultVisible ? turnout : undefined,
    author: {
      id: referendum.author.id,
      name: referendum.author.name,
      block: referendum.author.block,
      flatNumber: referendum.author.flatNumber,
    },
    canManage: canManageAnnouncements(me.roles),
    options,
  });
}

// PATCH /api/referendums/[id] — committee; ONLY while zero ballots (content lock).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const referendum = await prisma.referendum.findUnique({
    where: { id },
    select: { id: true, _count: { select: { ballots: true } } },
  });
  if (!referendum) return NextResponse.json({ error: "Referendum not found" }, { status: 404 });
  if (referendum._count.ballots > 0) {
    return NextResponse.json(
      { error: "Voting has started — this referendum can no longer be edited" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const v = validateReferendum(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // Replace options wholesale (safe: zero ballots, and counters are all 0).
  await prisma.$transaction([
    prisma.referendumOption.deleteMany({ where: { referendumId: id } }),
    prisma.referendum.update({
      where: { id },
      data: {
        title: v.data.title,
        body: v.data.body,
        imageUrl: v.data.imageUrl,
        eligibility: v.data.eligibility,
        closesAt: v.data.closesAt,
        options: { create: v.data.options.map((text, i) => ({ text, sortOrder: i })) },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/referendums/[id] — committee; ONLY while zero ballots.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const referendum = await prisma.referendum.findUnique({
    where: { id },
    select: { id: true, _count: { select: { ballots: true } } },
  });
  if (!referendum) return NextResponse.json({ error: "Referendum not found" }, { status: 404 });
  if (referendum._count.ballots > 0) {
    return NextResponse.json(
      { error: "Voting has started — this referendum can no longer be deleted" },
      { status: 409 }
    );
  }

  await prisma.referendum.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
