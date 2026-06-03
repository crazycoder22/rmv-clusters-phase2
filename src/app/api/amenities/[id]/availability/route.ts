import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  isValidYmd,
  slotAppliesOn,
  slotInstants,
  ACTIVE_BOOKING_STATUSES,
} from "@/lib/amenities";

export const dynamic = "force-dynamic";

// GET /api/amenities/[id]/availability?date=YYYY-MM-DD
// For each slot template applicable to that date, report capacity vs. how many
// active bookings already exist, plus whether the caller already booked it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!isValidYmd(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const amenity = await prisma.amenity.findUnique({
    where: { id },
    include: { slots: { orderBy: { startMinute: "asc" } } },
  });
  if (!amenity || !amenity.active) {
    return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
  }

  const now = Date.now();
  const applicable = amenity.slots.filter((s) => slotAppliesOn(s, date));

  // Pull this day's active bookings once, then bucket by slotId.
  const dayStart = slotInstants(date, 0, 0).start;
  const dayEnd = slotInstants(date, 1440, 1440).start;
  const bookings = await prisma.amenityBooking.findMany({
    where: {
      amenityId: id,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true, slotId: true, bookerId: true, status: true },
  });

  const slots = applicable.map((s) => {
    const { start, end } = slotInstants(date, s.startMinute, s.endMinute);
    const forSlot = bookings.filter((b) => b.slotId === s.id);
    const mine = forSlot.find((b) => b.bookerId === me.id);
    return {
      id: s.id,
      label: s.label,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      capacity: amenity.capacity,
      bookedCount: forSlot.length,
      available: Math.max(0, amenity.capacity - forSlot.length),
      isPast: end.getTime() <= now,
      myBookingId: mine?.id ?? null,
      myStatus: mine?.status ?? null,
    };
  });

  return NextResponse.json({
    date,
    requiresApproval: amenity.requiresApproval,
    fee: amenity.fee,
    slots,
  });
}
