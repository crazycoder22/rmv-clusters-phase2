import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAmenities, validateSlotMinutes } from "@/lib/amenities";

export const dynamic = "force-dynamic";

// POST /api/amenities/[id]/slots → add a recurring slot template (managers only).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAmenities(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const amenity = await prisma.amenity.findUnique({ where: { id }, select: { id: true } });
  if (!amenity) return NextResponse.json({ error: "Amenity not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const win = validateSlotMinutes(body?.startMinute, body?.endMinute);
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 400 });

  let dayOfWeek: number | null = null;
  if (body?.dayOfWeek != null) {
    const d = parseInt(body.dayOfWeek, 10);
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return NextResponse.json({ error: "dayOfWeek must be 0–6 or null" }, { status: 400 });
    }
    dayOfWeek = d;
  }

  const slot = await prisma.amenitySlot.create({
    data: {
      amenityId: id,
      label: typeof body?.label === "string" ? body.label.trim().slice(0, 40) || null : null,
      dayOfWeek,
      startMinute: win.start,
      endMinute: win.end,
    },
  });

  return NextResponse.json({ id: slot.id }, { status: 201 });
}
