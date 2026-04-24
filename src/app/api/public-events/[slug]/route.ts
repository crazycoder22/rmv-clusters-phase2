import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/public-events/[slug] — public read of event details (no auth).
// Does NOT expose the registrant list for privacy; returns only the count.
// For contribution-enabled events, also returns the total amount pledged
// and paid so the public page can render a thermometer.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await prisma.publicEvent.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      organizer: true,
      venue: true,
      startAt: true,
      endAt: true,
      registrationClosesAt: true,
      active: true,
      contributionEnabled: true,
      maxContribution: true,
      targetAmount: true,
      paymentInstructions: true,
      paymentQrImageUrl: true,
      upiId: true,
      _count: { select: { registrations: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let totals: {
    totalPledged: number;
    totalPaid: number;
    contributorCount: number;
  } | null = null;

  if (event.contributionEnabled) {
    const [pledgedAgg, paidAgg, contributorCount] = await Promise.all([
      prisma.publicEventRegistration.aggregate({
        where: { eventId: event.id, contributionAmount: { not: null } },
        _sum: { contributionAmount: true },
      }),
      prisma.publicEventRegistration.aggregate({
        where: {
          eventId: event.id,
          paid: true,
          contributionAmount: { not: null },
        },
        _sum: { contributionAmount: true },
      }),
      prisma.publicEventRegistration.count({
        where: { eventId: event.id, contributionAmount: { not: null } },
      }),
    ]);
    totals = {
      totalPledged: pledgedAgg._sum.contributionAmount ?? 0,
      totalPaid: paidAgg._sum.contributionAmount ?? 0,
      contributorCount,
    };
  }

  return NextResponse.json({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      organizer: event.organizer,
      venue: event.venue,
      startAt: event.startAt,
      endAt: event.endAt,
      registrationClosesAt: event.registrationClosesAt,
      active: event.active,
      contributionEnabled: event.contributionEnabled,
      maxContribution: event.maxContribution,
      targetAmount: event.targetAmount,
      paymentInstructions: event.paymentInstructions,
      paymentQrImageUrl: event.paymentQrImageUrl,
      upiId: event.upiId,
      registrationCount: event._count.registrations,
      totals,
    },
  });
}
