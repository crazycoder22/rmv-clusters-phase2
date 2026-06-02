import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { validatePoll } from "@/lib/groups";
import { isOrganizer } from "@/lib/group-auth";

// POST /api/groups/[id]/polls → organizer creates a poll, pushes all members
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await isOrganizer(id, me.id))) {
    return NextResponse.json({ error: "Only organizers can create polls" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const v = validatePoll(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { id }, select: { name: true } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const poll = await prisma.groupPoll.create({
    data: {
      groupId: id,
      authorId: me.id,
      title: v.data.title,
      playAt: v.data.playAt,
      closesAt: v.data.closesAt,
      options: { create: v.data.options.map((text, i) => ({ text, sortOrder: i })) },
    },
  });

  // Push all members except the author.
  const members = await prisma.groupMember.findMany({
    where: { groupId: id, residentId: { not: me.id } },
    select: { residentId: true },
  });
  if (members.length) {
    sendPushToResidents(members.map((m) => m.residentId), {
      title: `🏐 ${group.name}`,
      body: `New poll: ${v.data.title}`,
      data: { type: "group_poll", id: poll.id, groupId: id },
    }).catch(() => {});
  }

  return NextResponse.json({ id: poll.id }, { status: 201 });
}
