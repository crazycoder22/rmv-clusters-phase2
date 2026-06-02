import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isPollOpen, type GroupPollStatusValue } from "@/lib/groups";
import { myMembership, isOrganizer } from "@/lib/group-auth";

export const dynamic = "force-dynamic";

// GET /api/groups/[id]/polls/[pollId] → poll detail with PUBLIC voter lists
export async function GET(request: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pollId } = await params;
  const now = new Date();

  const poll = await prisma.groupPoll.findUnique({
    where: { id: pollId },
    include: {
      group: { select: { id: true, name: true } },
      author: { select: { name: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          votes: { include: { resident: { select: { id: true, name: true, block: true, flatNumber: true } } } },
        },
      },
    },
  });
  if (!poll || poll.groupId !== id) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  const membership = await myMembership(id, me.id);
  const canManage = membership?.role === "ORGANIZER";

  // My current vote (which option)
  const myVote = await prisma.groupPollVote.findUnique({
    where: { pollId_residentId: { pollId, residentId: me.id } },
    select: { optionId: true },
  });

  return NextResponse.json({
    id: poll.id,
    groupId: poll.groupId,
    groupName: poll.group.name,
    title: poll.title,
    author: poll.author.name,
    playAt: poll.playAt?.toISOString() ?? null,
    closesAt: poll.closesAt?.toISOString() ?? null,
    status: poll.status,
    isOpen: isPollOpen(poll.status as GroupPollStatusValue, poll.closesAt, now),
    outcome: poll.outcome,
    closeNote: poll.closeNote,
    closedAt: poll.closedAt?.toISOString() ?? null,
    isMember: !!membership,
    canManage,
    myOptionId: myVote?.optionId ?? null,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      voteCount: o.votes.length,
      voters: o.votes.map((vv) => ({
        residentId: vv.resident.id,
        name: vv.resident.name,
        block: vv.resident.block,
        flatNumber: vv.resident.flatNumber,
      })),
    })),
  });
}

// DELETE /api/groups/[id]/polls/[pollId] → organizer deletes the poll
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pollId } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const poll = await prisma.groupPoll.findUnique({ where: { id: pollId }, select: { groupId: true } });
  if (!poll || poll.groupId !== id) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  await prisma.groupPoll.delete({ where: { id: pollId } });
  return NextResponse.json({ ok: true });
}
