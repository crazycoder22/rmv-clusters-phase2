import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { canManageVendors } from "@/lib/roles";
import { cleanVendorItems } from "../route";

export const dynamic = "force-dynamic";

// GET /api/vendors/[id] — detail (anyone approved).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const v = await prisma.foodVendor.findUnique({
    where: { id },
    include: {
      addedBy: { select: { id: true, name: true, block: true, flatNumber: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canEdit = v.addedById === me.id || canManageVendors(me.roles);
  return NextResponse.json({
    id: v.id,
    name: v.name,
    phone: v.phone,
    description: v.description,
    notes: v.notes,
    deliveryInfo: v.deliveryInfo,
    photoUrl: v.photoUrl,
    forDate: v.forDate,
    active: v.active,
    canEdit,
    addedBy: { name: v.addedBy.name, block: v.addedBy.block, flatNumber: v.addedBy.flatNumber },
    items: v.items.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      unit: it.unit,
      section: it.section,
      note: it.note,
    })),
  });
}

// PATCH /api/vendors/[id] — adder or admin edits. Items = full replace.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const v = await prisma.foodVendor.findUnique({ where: { id }, select: { addedById: true } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (v.addedById !== me.id && !canManageVendors(me.roles)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    data.name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    if (!body.phone.trim()) return NextResponse.json({ error: "Phone can't be empty" }, { status: 400 });
    data.phone = body.phone.trim();
  }
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if ("notes" in body) data.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  if ("deliveryInfo" in body) data.deliveryInfo = typeof body.deliveryInfo === "string" ? body.deliveryInfo.trim() || null : null;
  if ("photoUrl" in body) data.photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : null;
  if ("forDate" in body) data.forDate = body.forDate ? new Date(body.forDate) : null;
  if (typeof body.active === "boolean") data.active = body.active;

  // Items: full replace when provided.
  let items: ReturnType<typeof cleanVendorItems> | null = null;
  if (body.items !== undefined) {
    items = cleanVendorItems(body.items);
    if ("error" in items) return NextResponse.json({ error: items.error }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.foodVendor.update({ where: { id }, data });
    if (items && "items" in items) {
      await tx.foodVendorItem.deleteMany({ where: { vendorId: id } });
      await tx.foodVendorItem.createMany({ data: items.items.map((it) => ({ ...it, vendorId: id })) });
    }
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/vendors/[id] — adder or admin.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const v = await prisma.foodVendor.findUnique({ where: { id }, select: { addedById: true } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (v.addedById !== me.id && !canManageVendors(me.roles)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await prisma.foodVendor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
