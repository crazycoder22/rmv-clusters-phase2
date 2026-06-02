import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isOrganizer } from "@/lib/group-auth";

// POST /api/groups/[id]/members {residentId} → organizer adds a member
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const residentId = typeof body?.residentId === "string" ? body.residentId : "";
  if (!residentId) return NextResponse.json({ error: "Missing residentId" }, { status: 400 });

  const r = await prisma.resident.findUnique({ where: { id: residentId }, select: { isApproved: true } });
  if (!r || !r.isApproved) return NextResponse.json({ error: "Resident not found" }, { status: 404 });

  await prisma.groupMember.upsert({
    where: { groupId_residentId: { groupId: id, residentId } },
    create: { groupId: id, residentId, role: "MEMBER" },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
