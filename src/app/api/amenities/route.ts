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

// GET /api/amenities → residents see active amenities; managers see all.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const canManage = canManageAmenities(me.roles);

  const amenities = await prisma.amenity.findMany({
    where: canManage ? {} : { active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  });

  return NextResponse.json({
    canManage,
    amenities: amenities.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      location: a.location,
      icon: a.icon,
      capacity: a.capacity,
      requiresApproval: a.requiresApproval,
      fee: a.fee,
      feeNote: a.feeNote,
      active: a.active,
      slotCount: a._count.slots,
    })),
  });
}

// POST /api/amenities → create (managers only).
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAmenities(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const capacity = Math.min(Math.max(parseInt(body?.capacity, 10) || 1, 1), MAX_CAPACITY);
  const bookingWindowDays = Math.min(
    Math.max(parseInt(body?.bookingWindowDays, 10) || 30, 1),
    MAX_WINDOW_DAYS
  );
  const fee = Math.max(Number(body?.fee) || 0, 0);
  const maxRaw = parseInt(body?.maxPerResident, 10);
  const maxPerResident = Number.isInteger(maxRaw) && maxRaw > 0 ? maxRaw : null;

  const amenity = await prisma.amenity.create({
    data: {
      name,
      description: typeof body?.description === "string" ? body.description.trim().slice(0, 500) || null : null,
      location: typeof body?.location === "string" ? body.location.trim().slice(0, 200) || null : null,
      icon: typeof body?.icon === "string" ? body.icon.trim().slice(0, 40) || null : null,
      capacity,
      requiresApproval: !!body?.requiresApproval,
      fee,
      feeNote: typeof body?.feeNote === "string" ? body.feeNote.trim().slice(0, MAX_NOTE) || null : null,
      payInfo: typeof body?.payInfo === "string" ? body.payInfo.trim().slice(0, MAX_NOTE) || null : null,
      payQrUrl: typeof body?.payQrUrl === "string" ? body.payQrUrl.trim() || null : null,
      maxPerResident,
      bookingWindowDays,
      active: body?.active === false ? false : true,
    },
  });

  return NextResponse.json({ id: amenity.id }, { status: 201 });
}
