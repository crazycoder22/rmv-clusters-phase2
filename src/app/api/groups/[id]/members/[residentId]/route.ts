import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isOrganizer } from "@/lib/group-auth";

// PATCH /api/groups/[id]/members/[residentId] {role} → organizer promotes/demotes
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; residentId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, residentId } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const role = body?.role === "ORGANIZER" ? "ORGANIZER" : body?.role === "MEMBER" ? "MEMBER" : null;
  if (!role) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const target = await prisma.groupMember.findUnique({
    where: { groupId_residentId: { groupId: id, residentId } },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Don't allow demoting the last organizer.
  if (role === "MEMBER") {
    const organizers = await prisma.groupMember.count({ where: { groupId: id, role: "ORGANIZER" } });
    const targetIsOrganizer = await prisma.groupMember.findFirst({
      where: { groupId: id, residentId, role: "ORGANIZER" },
      select: { id: true },
    });
    if (targetIsOrganizer && organizers === 1) {
      return NextResponse.json({ error: "A group must have at least one organizer" }, { status: 400 });
    }
  }

  await prisma.groupMember.update({
    where: { groupId_residentId: { groupId: id, residentId } },
    data: { role },
  });
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id]/members/[residentId] → organizer removes a member
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; residentId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, residentId } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Don't remove the last organizer.
  const target = await prisma.groupMember.findUnique({
    where: { groupId_residentId: { groupId: id, residentId } },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ ok: true });
  if (target.role === "ORGANIZER") {
    const organizers = await prisma.groupMember.count({ where: { groupId: id, role: "ORGANIZER" } });
    if (organizers === 1) {
      return NextResponse.json({ error: "Can't remove the last organizer" }, { status: 400 });
    }
  }

  await prisma.groupMember.delete({ where: { groupId_residentId: { groupId: id, residentId } } });
  return NextResponse.json({ ok: true });
}
