import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateGroup, isPollOpen, type GroupPollStatusValue } from "@/lib/groups";
import { isOrganizer } from "@/lib/group-auth";

export const dynamic = "force-dynamic";

// GET /api/groups/[id] → group detail: members (role + resident), my role, polls summary
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const now = new Date();

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { joinedAt: "asc" },
        include: { resident: { select: { id: true, name: true, block: true, flatNumber: true, googleImage: true } } },
      },
      polls: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { votes: true } } },
      },
    },
  });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const myRole = group.members.find((m) => m.residentId === me.id)?.role ?? null;

  // which polls have I voted on?
  const myVotes = await prisma.groupPollVote.findMany({
    where: { residentId: me.id, poll: { groupId: id } },
    select: { pollId: true },
  });
  const votedSet = new Set(myVotes.map((v) => v.pollId));

  return NextResponse.json({
    id: group.id,
    name: group.name,
    description: group.description,
    myRole,
    canManage: myRole === "ORGANIZER",
    members: group.members.map((m) => ({
      residentId: m.residentId,
      role: m.role,
      name: m.resident.name,
      block: m.resident.block,
      flatNumber: m.resident.flatNumber,
      googleImage: m.resident.googleImage,
    })),
    polls: group.polls.map((p) => ({
      id: p.id,
      title: p.title,
      playAt: p.playAt?.toISOString() ?? null,
      closesAt: p.closesAt?.toISOString() ?? null,
      status: p.status,
      isOpen: isPollOpen(p.status as GroupPollStatusValue, p.closesAt, now),
      outcome: p.outcome,
      closeNote: p.closeNote,
      voteCount: p._count.votes,
      myVoted: votedSet.has(p.id),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// PATCH /api/groups/[id] → organizer edits name/description
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const v = validateGroup(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await prisma.group.update({ where: { id }, data: { name: v.data.name, description: v.data.description } });
  return NextResponse.json({ ok: true });
}

// DELETE /api/groups/[id] → organizer deletes the group (cascades members/polls)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
