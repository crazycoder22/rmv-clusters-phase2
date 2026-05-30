import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessTasks } from "@/lib/roles";
import { validateChecklist } from "@/lib/duties";

export const dynamic = "force-dynamic";

// GET /api/admin/duty-checklists — list all (config view), with owner + item counts.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessTasks(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checklists = await prisma.dutyChecklist.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owners: { include: { resident: { select: { name: true, block: true, flatNumber: true } } } },
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({
    checklists: checklists.map((cl) => ({
      id: cl.id,
      title: cl.title,
      description: cl.description,
      reminderWave: cl.reminderWave,
      active: cl.active,
      itemCount: cl._count.items,
      owners: cl.owners.map((o) => ({
        residentId: o.residentId,
        name: o.resident.name,
        block: o.resident.block,
        flatNumber: o.resident.flatNumber,
      })),
    })),
  });
}

// POST /api/admin/duty-checklists — create.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canAccessTasks(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const v = validateChecklist(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const checklist = await prisma.dutyChecklist.create({
    data: {
      title: v.data.title,
      description: v.data.description,
      reminderWave: v.data.reminderWave,
      createdById: me.id,
      items: { create: v.data.items.map((title, i) => ({ title, sortOrder: i })) },
      owners: { create: v.data.ownerIds.map((residentId) => ({ residentId })) },
    },
  });

  return NextResponse.json({ id: checklist.id }, { status: 201 });
}
