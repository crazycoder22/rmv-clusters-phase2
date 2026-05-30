import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { validateWindow } from "@/lib/parking";

// POST /api/parking/slots/[id]/blocks → owner reserves a window for themselves
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const win = validateWindow(body.startAt, body.endAt, new Date());
  if (!win.ok) return NextResponse.json({ error: win.error }, { status: 400 });
  const { start, end } = win as { start: Date; end: Date };

  const clash = await prisma.parkingBooking.count({
    where: { slotId: id, status: "BOOKED", startAt: { lt: end }, endAt: { gt: start } },
  });
  if (clash > 0) {
    return NextResponse.json(
      { error: "Someone already booked that time — you can't block it" },
      { status: 409 }
    );
  }

  const block = await prisma.parkingBlock.create({
    data: {
      slotId: id,
      startAt: start,
      endAt: end,
      reason: typeof body.reason === "string" ? body.reason.trim() || null : null,
    },
  });
  return NextResponse.json({ id: block.id }, { status: 201 });
}

// DELETE /api/parking/slots/[id]/blocks?blockId=... → owner removes a block
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const blockId = new URL(request.url).searchParams.get("blockId");
  if (!blockId) return NextResponse.json({ error: "Missing blockId" }, { status: 400 });

  const slot = await prisma.parkingSlot.findUnique({ where: { id }, select: { ownerId: true } });
  if (!slot || slot.ownerId !== me.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const result = await prisma.parkingBlock.deleteMany({ where: { id: blockId, slotId: id } });
  if (result.count === 0) return NextResponse.json({ error: "Block not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
