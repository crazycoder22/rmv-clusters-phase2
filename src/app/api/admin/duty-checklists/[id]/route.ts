import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessTasks } from "@/lib/roles";
import { validateChecklist } from "@/lib/duties";

export const dynamic = "force-dynamic";

// GET /api/admin/duty-checklists/[id] — full config (items + owners).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTasks(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const cl = await prisma.dutyChecklist.findUnique({
    where: { id },
    include: {
      items: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
      owners: { include: { resident: { select: { name: true, block: true, flatNumber: true } } } },
    },
  });
  if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: cl.id,
    title: cl.title,
    description: cl.description,
    reminderWave: cl.reminderWave,
    active: cl.active,
    items: cl.items,
    owners: cl.owners.map((o) => ({
      residentId: o.residentId,
      name: o.resident.name,
      block: o.resident.block,
      flatNumber: o.resident.flatNumber,
    })),
  });
}

// PATCH /api/admin/duty-checklists/[id] — reconfigure (title/wave/active/items/owners).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTasks(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const exists = await prisma.dutyChecklist.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);

  // Allow a lightweight active-only toggle.
  if (body && typeof body === "object" && "active" in body && Object.keys(body).length === 1) {
    await prisma.dutyChecklist.update({ where: { id }, data: { active: !!body.active } });
    return NextResponse.json({ ok: true });
  }

  const v = validateChecklist(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const active = body && typeof body === "object" && "active" in body ? !!body.active : undefined;

  // Reconcile owners: desired set vs current.
  const currentOwners = await prisma.dutyChecklistOwner.findMany({
    where: { checklistId: id },
    select: { residentId: true },
  });
  const currentSet = new Set(currentOwners.map((o) => o.residentId));
  const desiredSet = new Set(v.data.ownerIds);
  const toAdd = v.data.ownerIds.filter((rid) => !currentSet.has(rid));
  const toRemove = [...currentSet].filter((rid) => !desiredSet.has(rid));

  // Items are replaced wholesale. Removing an item cascades its completions —
  // acceptable for a config change (history for removed items is discarded by design).
  await prisma.$transaction([
    prisma.dutyChecklist.update({
      where: { id },
      data: {
        title: v.data.title,
        description: v.data.description,
        reminderWave: v.data.reminderWave,
        ...(active !== undefined ? { active } : {}),
      },
    }),
    prisma.dutyChecklistItem.deleteMany({ where: { checklistId: id } }),
    prisma.dutyChecklistItem.createMany({
      data: v.data.items.map((title, i) => ({ checklistId: id, title, sortOrder: i })),
    }),
    ...(toRemove.length
      ? [prisma.dutyChecklistOwner.deleteMany({ where: { checklistId: id, residentId: { in: toRemove } } })]
      : []),
    ...(toAdd.length
      ? [prisma.dutyChecklistOwner.createMany({ data: toAdd.map((residentId) => ({ checklistId: id, residentId })) })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/duty-checklists/[id]
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTasks(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const exists = await prisma.dutyChecklist.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.dutyChecklist.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
