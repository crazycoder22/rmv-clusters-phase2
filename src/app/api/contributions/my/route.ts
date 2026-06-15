import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

// GET /api/contributions/my
//
// Returns the caller's own contributions to community drives. Contributions are
// stored on PublicEventRegistration.contributionAmount for contribution-enabled
// PublicEvents. Registrations carry no residentId — they're matched back to the
// logged-in resident by normalised phone. Strictly scoped to the caller; no
// other residents' rows and no admin notes are ever returned.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phone = normalizePhone(me.phone);
  if (!phone) {
    return NextResponse.json({
      contributions: [],
      totalPaid: 0,
      totalPledged: 0,
      count: 0,
    });
  }

  const regs = await prisma.publicEventRegistration.findMany({
    where: { phone, contributionAmount: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      eventId: true,
      contributionAmount: true,
      paid: true,
      paidAt: true,
      createdAt: true,
      event: { select: { title: true, slug: true, startAt: true, targetAmount: true } },
    },
  });

  // Community-wide totals per initiative (everyone's contributions), so each
  // entry can show "RMV raised ₹X · N contributors" against the initiative.
  const eventIds = [...new Set(regs.map((r) => r.eventId))];
  const totals = eventIds.length
    ? await prisma.publicEventRegistration.groupBy({
        by: ["eventId"],
        where: { eventId: { in: eventIds }, contributionAmount: { gt: 0 } },
        _sum: { contributionAmount: true },
        _count: { _all: true },
      })
    : [];
  const totalByEvent = new Map(
    totals.map((t) => [
      t.eventId,
      { raised: t._sum.contributionAmount ?? 0, contributors: t._count._all },
    ])
  );

  const contributions = regs.map((r) => {
    const agg = totalByEvent.get(r.eventId);
    return {
      id: r.id,
      eventTitle: r.event.title,
      eventSlug: r.event.slug,
      date: r.event.startAt,
      registeredAt: r.createdAt,
      amount: r.contributionAmount ?? 0,
      paid: r.paid,
      paidAt: r.paidAt,
      eventRaised: agg?.raised ?? r.contributionAmount ?? 0,
      eventContributors: agg?.contributors ?? 1,
      eventTarget: r.event.targetAmount ?? null,
    };
  });

  const totalPledged = contributions.reduce((s, c) => s + c.amount, 0);
  const totalPaid = contributions
    .filter((c) => c.paid)
    .reduce((s, c) => s + c.amount, 0);

  return NextResponse.json({
    contributions,
    totalPaid,
    totalPledged,
    count: contributions.length,
  });
}
