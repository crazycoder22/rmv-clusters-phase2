import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST /api/groups/[id]/join → join an open group (idempotent)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const group = await prisma.group.findUnique({ where: { id }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  await prisma.groupMember.upsert({
    where: { groupId_residentId: { groupId: id, residentId: me.id } },
    create: { groupId: id, residentId: me.id, role: "MEMBER" },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id]/join → leave the group
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const mine = await prisma.groupMember.findUnique({
    where: { groupId_residentId: { groupId: id, residentId: me.id } },
    select: { role: true },
  });
  if (!mine) return NextResponse.json({ ok: true }); // not a member → no-op

  // Guard: the sole organizer can't leave while other members remain.
  if (mine.role === "ORGANIZER") {
    const [organizers, total] = await Promise.all([
      prisma.groupMember.count({ where: { groupId: id, role: "ORGANIZER" } }),
      prisma.groupMember.count({ where: { groupId: id } }),
    ]);
    if (organizers === 1 && total > 1) {
      return NextResponse.json(
        { error: "Promote another member to organizer before leaving (or delete the group)." },
        { status: 400 }
      );
    }
  }

  await prisma.groupMember.delete({
    where: { groupId_residentId: { groupId: id, residentId: me.id } },
  });
  return NextResponse.json({ ok: true });
}
