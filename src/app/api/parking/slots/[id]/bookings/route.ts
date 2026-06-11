import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import {
  validateWindow,
  validateMonthlyWindow,
  computePrice,
  computeMonthlyTotal,
  monthsCeilYmd,
  formatDuration,
} from "@/lib/parking";

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

  // Hourly (default) or monthly. Monthly takes a start date + optional end date.
  const mode: "HOURLY" | "MONTHLY" = body.mode === "MONTHLY" ? "MONTHLY" : "HOURLY";
  let start: Date;
  let end: Date;
  let openEnded = false;
  let startYmd: string | null = null;
  let endYmd: string | null = null;
  if (mode === "MONTHLY") {
    const mw = validateMonthlyWindow(body.startAt, body.endAt, new Date());
    if (!mw.ok) return NextResponse.json({ error: mw.error }, { status: 400 });
    start = mw.start!;
    end = mw.end!;
    openEnded = mw.openEnded!;
    startYmd = mw.startYmd!;
    endYmd = mw.endYmd ?? null;
  } else {
    const win = validateWindow(body.startAt, body.endAt, new Date());
    if (!win.ok) return NextResponse.json({ error: win.error }, { status: 400 });
    start = win.start!;
    end = win.end!;
  }

  const vehicleNumber =
    typeof body.vehicleNumber === "string" ? body.vehicleNumber.trim().toUpperCase() || null : null;
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  try {
    const { booking, ownerId, slotLabel, monthlyRateSnapshot } = await prisma.$transaction(async (tx) => {
      // Serialize bookings for this slot: lock the row for the txn's lifetime.
      await tx.$queryRaw`SELECT id FROM parking_slots WHERE id = ${id} FOR UPDATE`;

      const slot = await tx.parkingSlot.findUnique({
        where: { id },
        select: { id: true, ownerId: true, active: true, hourlyRate: true, monthlyRate: true, label: true },
      });
      if (!slot) throw new BookingError(404, "Slot not found");
      if (!slot.active) throw new BookingError(409, "This slot isn't available for booking right now");
      if (slot.ownerId === me.id) {
        throw new BookingError(400, "You own this slot — use “Block time” to reserve it for yourself");
      }
      if (mode === "MONTHLY" && slot.monthlyRate == null) {
        throw new BookingError(409, "This slot isn't offered for monthly rental");
      }

      // Overlap check is identical for both modes — a monthly window (or an
      // open-ended sentinel-ended booking) is just a long interval, so it both
      // clashes with and blocks hourly + monthly bookings.
      const clash = await tx.parkingBooking.count({
        where: { slotId: id, status: "BOOKED", startAt: { lt: end }, endAt: { gt: start } },
      });
      if (clash > 0) throw new BookingError(409, "That time overlaps an existing booking. Pick another window.");

      const blocked = await tx.parkingBlock.count({
        where: { slotId: id, startAt: { lt: end }, endAt: { gt: start } },
      });
      if (blocked > 0) throw new BookingError(409, "The owner has blocked that time. Pick another window.");

      const total =
        mode === "MONTHLY"
          ? computeMonthlyTotal(slot.monthlyRate!, startYmd!, endYmd)
          : computePrice(slot.hourlyRate, start, end);
      const created = await tx.parkingBooking.create({
        data: {
          slotId: id,
          bookerId: me.id,
          startAt: start,
          endAt: end,
          vehicleNumber,
          note,
          status: "BOOKED",
          mode,
          openEnded,
          hourlyRateSnapshot: mode === "MONTHLY" ? null : slot.hourlyRate,
          monthlyRateSnapshot: mode === "MONTHLY" ? slot.monthlyRate : null,
          totalAmount: total,
        },
      });
      return { booking: created, ownerId: slot.ownerId, slotLabel: slot.label, monthlyRateSnapshot: slot.monthlyRate };
    });

    // Notify the owner (best-effort).
    const pushBody =
      mode === "MONTHLY"
        ? `${me.name} booked ${slotLabel} monthly · ₹${monthlyRateSnapshot}/mo · from ${startYmd}${openEnded ? " · ongoing" : ` · ${monthsCeilYmd(startYmd!, endYmd!)} mo`}`
        : `${me.name} booked ${slotLabel} · ${formatDuration(start, end)} · ₹${booking.totalAmount}`;
    sendPushToResidents([ownerId], {
      title: "New parking booking",
      body: pushBody,
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
