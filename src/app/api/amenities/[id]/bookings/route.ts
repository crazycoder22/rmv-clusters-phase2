import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import {
  isValidYmd,
  slotAppliesOn,
  slotInstants,
  ACTIVE_BOOKING_STATUSES,
  managerIds,
  MAX_NOTE,
  addDaysInWindow,
} from "@/lib/amenities";

class BookingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// POST /api/amenities/[id]/bookings  body: { date, slotId, note? }
// Capacity is enforced under a row lock on the amenity: we re-count active
// bookings for the resolved window inside the txn, so concurrent requests can't
// oversubscribe a slot.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const slotId = body?.slotId;
  if (!isValidYmd(date) || typeof slotId !== "string" || !slotId) {
    return NextResponse.json({ error: "date and slotId are required" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize all bookings for this amenity for the txn's lifetime.
      await tx.$queryRaw`SELECT id FROM amenities WHERE id = ${id} FOR UPDATE`;

      const amenity = await tx.amenity.findUnique({
        where: { id },
        select: {
          id: true, name: true, active: true, capacity: true,
          requiresApproval: true, fee: true, maxPerResident: true, bookingWindowDays: true,
        },
      });
      if (!amenity || !amenity.active) throw new BookingError(404, "Amenity not available");

      const slot = await tx.amenitySlot.findFirst({
        where: { id: slotId, amenityId: id },
        select: { id: true, dayOfWeek: true, startMinute: true, endMinute: true },
      });
      if (!slot) throw new BookingError(404, "Slot not found");
      if (!slotAppliesOn(slot, date)) {
        throw new BookingError(400, "That slot isn't available on this day");
      }

      const { start, end } = slotInstants(date, slot.startMinute, slot.endMinute);
      const now = new Date();
      if (end.getTime() <= now.getTime()) {
        throw new BookingError(400, "That time has already passed");
      }
      if (!addDaysInWindow(now, start, amenity.bookingWindowDays)) {
        throw new BookingError(400, `You can only book up to ${amenity.bookingWindowDays} days ahead`);
      }

      // Per-resident cap (active/future bookings for this amenity).
      if (amenity.maxPerResident != null) {
        const mine = await tx.amenityBooking.count({
          where: {
            amenityId: id,
            bookerId: me.id,
            status: { in: [...ACTIVE_BOOKING_STATUSES] },
            endAt: { gt: now },
          },
        });
        if (mine >= amenity.maxPerResident) {
          throw new BookingError(409, `You've reached your limit of ${amenity.maxPerResident} active booking(s) for ${amenity.name}`);
        }
      }

      // Already booked this exact slot+day?
      const dup = await tx.amenityBooking.findFirst({
        where: { slotId, bookerId: me.id, startAt: start, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        select: { id: true },
      });
      if (dup) throw new BookingError(409, "You've already booked this slot");

      // Capacity: count active bookings overlapping the resolved window.
      const taken = await tx.amenityBooking.count({
        where: {
          amenityId: id,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          startAt: { lt: end },
          endAt: { gt: start },
        },
      });
      if (taken >= amenity.capacity) {
        throw new BookingError(409, "This slot is fully booked. Pick another.");
      }

      const status = amenity.requiresApproval ? "PENDING" : "CONFIRMED";
      const created = await tx.amenityBooking.create({
        data: {
          amenityId: id,
          slotId,
          bookerId: me.id,
          startAt: start,
          endAt: end,
          status,
          feeSnapshot: amenity.fee,
          note,
        },
      });
      return { booking: created, amenityName: amenity.name, requiresApproval: amenity.requiresApproval };
    });

    // Notify managers about a pending request (best-effort).
    if (result.requiresApproval) {
      managerIds()
        .then((ids) => {
          if (ids.length === 0) return;
          return sendPushToResidents(ids, {
            title: "New booking request",
            body: `${me.name} requested ${result.amenityName} — approval needed`,
            data: { type: "amenity_request", id: result.booking.id },
          });
        })
        .catch(() => {});
    }

    return NextResponse.json(
      { id: result.booking.id, status: result.booking.status },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof BookingError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[amenity booking] failed", e);
    return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
  }
}
