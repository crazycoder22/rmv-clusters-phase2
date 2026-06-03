import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAmenities } from "@/lib/amenities";

export const dynamic = "force-dynamic";

// GET /api/amenities/bookings
//   ?scope=mine      → my bookings (default)
//   ?scope=pending   → managers: all PENDING approval requests
// Optional ?when=upcoming|past filters mine by time.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "mine";
  const when = url.searchParams.get("when");
  const now = new Date();

  if (scope === "pending") {
    if (!canManageAmenities(me.roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const pending = await prisma.amenityBooking.findMany({
      where: { status: "PENDING" },
      orderBy: { startAt: "asc" },
      include: {
        amenity: { select: { name: true } },
        booker: { select: { name: true, block: true, flatNumber: true } },
      },
    });
    return NextResponse.json({
      bookings: pending.map((b) => ({
        id: b.id,
        amenityName: b.amenity.name,
        bookerName: b.booker.name,
        bookerBlock: b.booker.block,
        bookerFlat: b.booker.flatNumber,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        feeSnapshot: b.feeSnapshot,
        note: b.note,
      })),
    });
  }

  const where: Record<string, unknown> = { bookerId: me.id };
  if (when === "upcoming") where.endAt = { gt: now };
  else if (when === "past") where.endAt = { lte: now };

  const bookings = await prisma.amenityBooking.findMany({
    where,
    orderBy: { startAt: when === "past" ? "desc" : "asc" },
    include: { amenity: { select: { name: true, icon: true } } },
  });

  return NextResponse.json({
    canManage: canManageAmenities(me.roles),
    bookings: bookings.map((b) => ({
      id: b.id,
      amenityName: b.amenity.name,
      amenityIcon: b.amenity.icon,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      status: b.status,
      feeSnapshot: b.feeSnapshot,
      bookerPaid: b.bookerPaid,
      adminConfirmedPaid: b.adminConfirmedPaid,
    })),
  });
}
