import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateGroup } from "@/lib/groups";

export const dynamic = "force-dynamic";

// GET /api/groups → all groups with member count + my membership role (or null)
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true } },
      members: { where: { residentId: me.id }, select: { role: true } },
    },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g._count.members,
      myRole: g.members[0]?.role ?? null,
    })),
  });
}

// POST /api/groups → any approved resident creates a group, becomes ORGANIZER
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const v = validateGroup(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const group = await prisma.group.create({
    data: {
      name: v.data.name,
      description: v.data.description,
      createdById: me.id,
      members: { create: { residentId: me.id, role: "ORGANIZER" } },
    },
  });

  return NextResponse.json({ id: group.id }, { status: 201 });
}
