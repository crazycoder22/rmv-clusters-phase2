import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { validateWindow, computePrice, formatDuration } from "@/lib/parking";

class BookingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// POST /api/parking/slots/[id]/bookings → reserve a window.
// Double-booking is impossible: we take a row lock on the slot inside the
// transaction, then re-check overlaps before inserting.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const win = validateWindow(body.startAt, body.endAt, new Date());
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 400 });
  const { start, end } = win as { start: Date; end: Date };

  const vehicleNumber =
    typeof body.vehicleNumber === "string" ? body.vehicleNumber.trim().toUpperCase() || null : null;
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  try {
    const { booking, ownerId, slotLabel } = await prisma.$transaction(async (tx) => {
      // Serialize bookings for this slot: lock the row for the txn's lifetime.
      await tx.$queryRaw`SELECT id FROM parking_slots WHERE id = ${id} FOR UPDATE`;

      const slot = await tx.parkingSlot.findUnique({
        where: { id },
        select: { id: true, ownerId: true, active: true, hourlyRate: true, label: true },
      });
      if (!slot) throw new BookingError(404, "Slot not found");
      if (!slot.active) throw new BookingError(409, "This slot isn't available for booking right now");
      if (slot.ownerId === me.id) {
        throw new BookingError(400, "You own this slot — use “Block time” to reserve it for yourself");
      }

      const clash = await tx.parkingBooking.count({
        where: { slotId: id, status: "BOOKED", startAt: { lt: end }, endAt: { gt: start } },
      });
      if (clash > 0) throw new BookingError(409, "That time overlaps an existing booking. Pick another window.");

      const blocked = await tx.parkingBlock.count({
        where: { slotId: id, startAt: { lt: end }, endAt: { gt: start } },
      });
      if (blocked > 0) throw new BookingError(409, "The owner has blocked that time. Pick another window.");

      const total = computePrice(slot.hourlyRate, start, end);
      const created = await tx.parkingBooking.create({
        data: {
          slotId: id,
          bookerId: me.id,
          startAt: start,
          endAt: end,
          vehicleNumber,
          note,
          status: "BOOKED",
          hourlyRateSnapshot: slot.hourlyRate,
          totalAmount: total,
        },
      });
      return { booking: created, ownerId: slot.ownerId, slotLabel: slot.label };
    });

    // Notify the owner (best-effort).
    sendPushToResidents([ownerId], {
      title: "New parking booking",
      body: `${me.name} booked ${slotLabel} · ${formatDuration(start, end)} · ₹${booking.totalAmount}`,
      data: { type: "parking_booked", id },
    }).catch(() => {});

    return NextResponse.json(
      { id: booking.id, totalAmount: booking.totalAmount },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("parking booking error", err);
    return NextResponse.json({ error: "Could not complete the booking" }, { status: 500 });
  }
}
