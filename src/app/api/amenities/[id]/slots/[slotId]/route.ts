import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAmenities } from "@/lib/amenities";

// DELETE /api/amenities/[id]/slots/[slotId] → remove a slot template (managers only).
// Cascades any bookings made against this slot.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAmenities(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, slotId } = await params;

  await prisma.amenitySlot.deleteMany({ where: { id: slotId, amenityId: id } });
  return NextResponse.json({ ok: true });
}
