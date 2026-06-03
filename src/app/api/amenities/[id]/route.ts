import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  canManageAmenities,
  MAX_NAME,
  MAX_NOTE,
  MAX_CAPACITY,
  MAX_WINDOW_DAYS,
} from "@/lib/amenities";

export const dynamic = "force-dynamic";

// GET /api/amenities/[id] → amenity detail + its slot templates.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const amenity = await prisma.amenity.findUnique({
    where: { id },
    include: {
      slots: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
    },
  });
  if (!amenity) return NextResponse.json({ error: "Amenity not found" }, { status: 404 });

  const canManage = canManageAmenities(me.roles);
  if (!amenity.active && !canManage) {
    return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
  }

  return NextResponse.json({
    canManage,
    amenity: {
      id: amenity.id,
      name: amenity.name,
      description: amenity.description,
      location: amenity.location,
      icon: amenity.icon,
      capacity: amenity.capacity,
      requiresApproval: amenity.requiresApproval,
      fee: amenity.fee,
      feeNote: amenity.feeNote,
      payInfo: amenity.payInfo,
      payQrUrl: amenity.payQrUrl,
      maxPerResident: amenity.maxPerResident,
      bookingWindowDays: amenity.bookingWindowDays,
      active: amenity.active,
      slots: amenity.slots.map((s) => ({
        id: s.id,
        label: s.label,
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
    },
  });
}

// PATCH /api/amenities/[id] → edit (managers only).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAmenities(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, MAX_NAME);
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim().slice(0, 500) || null : null;
  if ("location" in body) data.location = typeof body.location === "string" ? body.location.trim().slice(0, 200) || null : null;
  if ("icon" in body) data.icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 40) || null : null;
  if ("capacity" in body) data.capacity = Math.min(Math.max(parseInt(body.capacity, 10) || 1, 1), MAX_CAPACITY);
  if ("requiresApproval" in body) data.requiresApproval = !!body.requiresApproval;
  if ("fee" in body) data.fee = Math.max(Number(body.fee) || 0, 0);
  if ("feeNote" in body) data.feeNote = typeof body.feeNote === "string" ? body.feeNote.trim().slice(0, MAX_NOTE) || null : null;
  if ("payInfo" in body) data.payInfo = typeof body.payInfo === "string" ? body.payInfo.trim().slice(0, MAX_NOTE) || null : null;
  if ("payQrUrl" in body) data.payQrUrl = typeof body.payQrUrl === "string" ? body.payQrUrl.trim() || null : null;
  if ("maxPerResident" in body) {
    const m = parseInt(body.maxPerResident, 10);
    data.maxPerResident = Number.isInteger(m) && m > 0 ? m : null;
  }
  if ("bookingWindowDays" in body) {
    data.bookingWindowDays = Math.min(Math.max(parseInt(body.bookingWindowDays, 10) || 30, 1), MAX_WINDOW_DAYS);
  }
  if ("active" in body) data.active = !!body.active;

  await prisma.amenity.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/amenities/[id] → delete (managers only). Cascades slots + bookings.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAmenities(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  await prisma.amenity.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
