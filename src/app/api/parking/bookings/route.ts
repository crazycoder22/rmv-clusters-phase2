import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

// GET /api/parking/bookings → my bookings, split into:
//   asBooker — slots I've booked
//   asOwner  — bookings other residents made on my slots
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [asBooker, asOwner] = await Promise.all([
    prisma.parkingBooking.findMany({
      where: { bookerId: me.id },
      orderBy: { startAt: "desc" },
      include: {
        slot: {
          select: {
            id: true,
            label: true,
            location: true,
            payInfo: true,
            payQrUrl: true,
            owner: { select: { name: true, block: true, flatNumber: true } },
          },
        },
      },
    }),
    prisma.parkingBooking.findMany({
      where: { slot: { ownerId: me.id } },
      orderBy: { startAt: "desc" },
      include: {
        slot: { select: { id: true, label: true } },
        booker: { select: { name: true, block: true, flatNumber: true } },
      },
    }),
  ]);

  return NextResponse.json({
    asBooker: asBooker.map((b) => ({
      id: b.id,
      slotId: b.slot.id,
      slotLabel: b.slot.label,
      slotLocation: b.slot.location,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      vehicleNumber: b.vehicleNumber,
      totalAmount: b.totalAmount,
      bookerPaid: b.bookerPaid,
      ownerConfirmedPaid: b.ownerConfirmedPaid,
      payInfo: b.slot.payInfo,
      payQrUrl: b.slot.payQrUrl,
      owner: b.slot.owner,
    })),
    asOwner: asOwner.map((b) => ({
      id: b.id,
      slotId: b.slot.id,
      slotLabel: b.slot.label,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      vehicleNumber: b.vehicleNumber,
      totalAmount: b.totalAmount,
      bookerPaid: b.bookerPaid,
      ownerConfirmedPaid: b.ownerConfirmedPaid,
      booker: b.booker,
    })),
  });
}
