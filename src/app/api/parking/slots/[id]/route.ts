import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateRate, validateMonthlyRate, SENTINEL_END } from "@/lib/parking";

// GET /api/parking/slots/[id] → slot detail.
// Owner sees every booking + booker contact. Others see anonymized busy
// windows (so they can pick a free time) plus their own bookings in full.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const now = new Date();

  const slot = await prisma.parkingSlot.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, block: true, flatNumber: true } },
      blocks: { where: { endAt: { gt: now } }, orderBy: { startAt: "asc" } },
      bookings: {
        where: { OR: [{ status: "BOOKED" }, { bookerId: me.id }] },
        orderBy: { startAt: "asc" },
        include: { booker: { select: { id: true, name: true, block: true, flatNumber: true } } },
      },
    },
  });
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });

  const isOwner = slot.owner.id === me.id;

  // Busy windows everyone can see (to avoid clashes): active BOOKED + owner blocks.
  const busy = [
    ...slot.bookings
      .filter((b) => b.status === "BOOKED" && b.endAt.getTime() > now.getTime())
      .map((b) => ({
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        kind: "booking" as const,
        mode: b.mode,
        ongoing: b.endAt.getTime() === SENTINEL_END.getTime(),
      })),
    ...slot.blocks.map((bl) => ({
      startAt: bl.startAt.toISOString(),
      endAt: bl.endAt.toISOString(),
      kind: "block" as const,
      mode: "HOURLY" as const,
      ongoing: false,
    })),
  ].sort((a, b) => a.startAt.localeCompare(b.startAt));

  const myBookings = slot.bookings
    .filter((b) => b.booker.id === me.id)
    .map((b) => serializeBooking(b, true));

  const ownerBookings = isOwner ? slot.bookings.map((b) => serializeBooking(b, true)) : null;

  return NextResponse.json({
    id: slot.id,
    label: slot.label,
    location: slot.location,
    description: slot.description,
    hourlyRate: slot.hourlyRate,
    monthlyRate: slot.monthlyRate,
    active: slot.active,
    payInfo: slot.payInfo,
    payQrUrl: slot.payQrUrl,
    photoUrl: slot.photoUrl,
    owner: {
      id: slot.owner.id,
      name: slot.owner.name,
      block: slot.owner.block,
      flatNumber: slot.owner.flatNumber,
      isMe: isOwner,
    },
    busy,
    myBookings,
    ownerBookings, // null for non-owners
  });
}

// PATCH /api/parking/slots/[id] → owner edits the listing
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const slot = await prisma.parkingSlot.findUnique({ where: { id }, select: { ownerId: true } });
  if (!slot || slot.ownerId !== me.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") {
    if (!body.label.trim()) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.label = body.label.trim();
  }
  if ("location" in body) data.location = typeof body.location === "string" ? body.location.trim() || null : null;
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if ("payInfo" in body) data.payInfo = typeof body.payInfo === "string" ? body.payInfo.trim() || null : null;
  if ("payQrUrl" in body) data.payQrUrl = typeof body.payQrUrl === "string" ? body.payQrUrl.trim() || null : null;
  if ("photoUrl" in body) data.photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : null;
  if (typeof body.active === "boolean") data.active = body.active;
  if ("hourlyRate" in body) {
    const rc = validateRate(body.hourlyRate);
    if (!rc.ok) return NextResponse.json({ error: rc.error }, { status: 400 });
    data.hourlyRate = rc.rate;
  }
  if ("monthlyRate" in body) {
    // null / empty → clear (monthly no longer offered).
    if (body.monthlyRate == null || String(body.monthlyRate).trim() === "") {
      data.monthlyRate = null;
    } else {
      const mc = validateMonthlyRate(body.monthlyRate);
      if (!mc.ok) return NextResponse.json({ error: mc.error }, { status: 400 });
      data.monthlyRate = mc.rate;
    }
  }

  await prisma.parkingSlot.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/parking/slots/[id] → owner removes the listing.
// If there are upcoming bookings, soft-disable instead of deleting.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const slot = await prisma.parkingSlot.findUnique({ where: { id }, select: { ownerId: true } });
  if (!slot || slot.ownerId !== me.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const upcoming = await prisma.parkingBooking.count({
    where: { slotId: id, status: "BOOKED", endAt: { gt: new Date() } },
  });
  if (upcoming > 0) {
    await prisma.parkingSlot.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, softDisabled: true, upcoming });
  }
  await prisma.parkingSlot.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}

function serializeBooking(
  b: {
    id: string;
    startAt: Date;
    endAt: Date;
    status: string;
    mode: string;
    openEnded: boolean;
    vehicleNumber: string | null;
    note: string | null;
    totalAmount: number;
    hourlyRateSnapshot: number | null;
    monthlyRateSnapshot: number | null;
    bookerPaid: boolean;
    ownerConfirmedPaid: boolean;
    booker: { id: string; name: string; block: number | null; flatNumber: string };
  },
  withBooker: boolean
) {
  return {
    id: b.id,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    status: b.status,
    mode: b.mode,
    openEnded: b.openEnded,
    vehicleNumber: b.vehicleNumber,
    note: b.note,
    totalAmount: b.totalAmount,
    hourlyRate: b.hourlyRateSnapshot,
    monthlyRate: b.monthlyRateSnapshot,
    bookerPaid: b.bookerPaid,
    ownerConfirmedPaid: b.ownerConfirmedPaid,
    booker: withBooker
      ? { id: b.booker.id, name: b.booker.name, block: b.booker.block, flatNumber: b.booker.flatNumber }
      : null,
  };
}
