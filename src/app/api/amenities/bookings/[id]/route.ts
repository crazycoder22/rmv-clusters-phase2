import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { canManageAmenities } from "@/lib/amenities";

export const dynamic = "force-dynamic";

// GET /api/amenities/bookings/[id] → detail. Visible to the booker or a manager.
// Pay info (UPI / QR) is included only for the booker.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const b = await prisma.amenityBooking.findUnique({
    where: { id },
    include: {
      amenity: { select: { name: true, location: true, requiresApproval: true, payInfo: true, payQrUrl: true } },
      booker: { select: { name: true, block: true, flatNumber: true } },
    },
  });
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const amBooker = b.bookerId === me.id;
  const canManage = canManageAmenities(me.roles);
  if (!amBooker && !canManage) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: b.id,
    amenityName: b.amenity.name,
    location: b.amenity.location,
    bookerName: b.booker.name,
    bookerBlock: b.booker.block,
    bookerFlat: b.booker.flatNumber,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    feeSnapshot: b.feeSnapshot,
    note: b.note,
    bookerPaid: b.bookerPaid,
    adminConfirmedPaid: b.adminConfirmedPaid,
    cancelledBy: b.cancelledBy,
    amBooker,
    canManage,
    // Pay info only to the booker (and only when a fee applies).
    payInfo: amBooker && b.feeSnapshot > 0 ? b.amenity.payInfo : null,
    payQrUrl: amBooker && b.feeSnapshot > 0 ? b.amenity.payQrUrl : null,
  });
}

// PATCH /api/amenities/bookings/[id]  body: { action }
//   approve | reject          → managers, on PENDING
//   markPaid | unmarkPaid      → booker toggles "I've paid"
//   confirmPaid | unconfirmPaid→ managers confirm receipt
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const action = body?.action;

  const b = await prisma.amenityBooking.findUnique({
    where: { id },
    select: { id: true, bookerId: true, status: true, amenityId: true, amenity: { select: { name: true } } },
  });
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const amBooker = b.bookerId === me.id;
  const canManage = canManageAmenities(me.roles);

  if (action === "approve" || action === "reject") {
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (b.status !== "PENDING") {
      return NextResponse.json({ error: "This request was already handled" }, { status: 409 });
    }
    const newStatus = action === "approve" ? "CONFIRMED" : "REJECTED";
    const res = await prisma.amenityBooking.updateMany({
      where: { id, status: "PENDING" },
      data: { status: newStatus, approvedById: me.id, approvedAt: new Date() },
    });
    if (res.count !== 1) {
      return NextResponse.json({ error: "This request was already handled" }, { status: 409 });
    }
    sendPushToResidents([b.bookerId], {
      title: action === "approve" ? "✅ Booking approved" : "Booking declined",
      body:
        action === "approve"
          ? `Your ${b.amenity.name} booking is confirmed.`
          : `Your ${b.amenity.name} request was declined.`,
      data: { type: "amenity_booking", id },
    }).catch(() => {});
    return NextResponse.json({ ok: true, status: newStatus });
  }

  if (action === "markPaid" || action === "unmarkPaid") {
    if (!amBooker) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const paid = action === "markPaid";
    await prisma.amenityBooking.update({
      where: { id },
      data: { bookerPaid: paid, bookerPaidAt: paid ? new Date() : null },
    });
    return NextResponse.json({ ok: true, bookerPaid: paid });
  }

  if (action === "confirmPaid" || action === "unconfirmPaid") {
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const confirmed = action === "confirmPaid";
    await prisma.amenityBooking.update({
      where: { id },
      data: { adminConfirmedPaid: confirmed, adminConfirmedPaidAt: confirmed ? new Date() : null },
    });
    return NextResponse.json({ ok: true, adminConfirmedPaid: confirmed });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

// DELETE /api/amenities/bookings/[id] → cancel. Booker (before start) or a manager.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const b = await prisma.amenityBooking.findUnique({
    where: { id },
    select: { id: true, bookerId: true, status: true, startAt: true, amenity: { select: { name: true } } },
  });
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const amBooker = b.bookerId === me.id;
  const canManage = canManageAmenities(me.roles);
  if (!amBooker && !canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (b.status === "CANCELLED" || b.status === "REJECTED") {
    return NextResponse.json({ ok: true, status: b.status });
  }
  if (amBooker && !canManage && b.startAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "This booking has already started" }, { status: 400 });
  }

  await prisma.amenityBooking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledBy: canManage && !amBooker ? "admin" : "booker" },
  });

  // If a manager cancelled someone else's booking, let the booker know.
  if (canManage && !amBooker) {
    sendPushToResidents([b.bookerId], {
      title: "Booking cancelled",
      body: `Your ${b.amenity.name} booking was cancelled by management.`,
      data: { type: "amenity_booking", id },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
