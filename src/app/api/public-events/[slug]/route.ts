import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/public-events/[slug] — public read of event details (no auth).
// Does NOT expose the registrant list for privacy; returns only the count.
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
      _count: { select: { registrations: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
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
      registrationCount: event._count.registrations,
    },
  });
}
