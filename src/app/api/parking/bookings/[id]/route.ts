import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { sendPushToResidents } from "@/lib/push";

type Action =
  | "claim_paid"
  | "unclaim_paid"
  | "confirm_paid"
  | "unconfirm_paid"
  | "cancel";

// PATCH /api/parking/bookings/[id] → payment toggles + cancellation.
// All transitions are atomic updateMany guards (count===1 or 409).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const action: Action | undefined = body?.action;
  if (!action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  const booking = await prisma.parkingBooking.findUnique({
    where: { id },
    include: {
      slot: { select: { ownerId: true, label: true } },
      booker: { select: { id: true, name: true } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const isBooker = booking.bookerId === me.id;
  const isOwner = booking.slot.ownerId === me.id;
  if (!isBooker && !isOwner) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const now = new Date();

  switch (action) {
    case "claim_paid":
    case "unclaim_paid": {
      if (!isBooker) return NextResponse.json({ error: "Only the booker can do this" }, { status: 403 });
      const paid = action === "claim_paid";
      const res = await prisma.parkingBooking.updateMany({
        where: { id, bookerId: me.id, bookerPaid: !paid, status: "BOOKED" },
        data: { bookerPaid: paid, bookerPaidAt: paid ? now : null },
      });
      if (res.count !== 1) return NextResponse.json({ error: "Already updated" }, { status: 409 });
      if (paid) {
        sendPushToResidents([booking.slot.ownerId], {
          title: "Parking payment marked",
          body: `${me.name} marked ₹${booking.totalAmount} paid for ${booking.slot.label}`,
          data: { type: "parking_payment", id: booking.id },
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, bookerPaid: paid });
    }

    case "confirm_paid":
    case "unconfirm_paid": {
      if (!isOwner) return NextResponse.json({ error: "Only the owner can confirm" }, { status: 403 });
      const confirmed = action === "confirm_paid";
      const res = await prisma.parkingBooking.updateMany({
        where: { id, ownerConfirmedPaid: !confirmed },
        data: { ownerConfirmedPaid: confirmed, ownerConfirmedPaidAt: confirmed ? now : null },
      });
      if (res.count !== 1) return NextResponse.json({ error: "Already updated" }, { status: 409 });
      if (confirmed) {
        sendPushToResidents([booking.bookerId], {
          title: "Payment confirmed",
          body: `${booking.slot.label}: the owner confirmed your ₹${booking.totalAmount} payment`,
          data: { type: "parking_payment", id: booking.id },
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, ownerConfirmedPaid: confirmed });
    }

    case "cancel": {
      // Booker may cancel only before it starts; owner may cancel anytime.
      if (isBooker && !isOwner && booking.startAt.getTime() <= now.getTime()) {
        return NextResponse.json({ error: "This booking has already started" }, { status: 400 });
      }
      const res = await prisma.parkingBooking.updateMany({
        where: { id, status: "BOOKED" },
        data: { status: "CANCELLED", cancelledBy: isOwner ? "owner" : "booker" },
      });
      if (res.count !== 1) return NextResponse.json({ error: "Already cancelled or completed" }, { status: 409 });

      // Notify the other party.
      if (isOwner) {
        sendPushToResidents([booking.bookerId], {
          title: "Parking booking cancelled",
          body: `The owner cancelled your booking for ${booking.slot.label}`,
          data: { type: "parking_cancelled", id: booking.slotId },
        }).catch(() => {});
      } else {
        sendPushToResidents([booking.slot.ownerId], {
          title: "Parking booking cancelled",
          body: `${me.name} cancelled their booking for ${booking.slot.label}`,
          data: { type: "parking_cancelled", id: booking.slotId },
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true, status: "CANCELLED" });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
