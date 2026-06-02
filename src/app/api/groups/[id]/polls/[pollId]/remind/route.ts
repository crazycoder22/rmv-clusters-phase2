import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { isPollOpen, type GroupPollStatusValue } from "@/lib/groups";
import { isOrganizer } from "@/lib/group-auth";

// POST /api/groups/[id]/polls/[pollId]/remind → organizer nudges members who
// haven't voted yet (push). Only while the poll is open.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pollId } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const poll = await prisma.groupPoll.findUnique({
    where: { id: pollId },
    select: { groupId: true, title: true, status: true, closesAt: true, group: { select: { name: true } } },
  });
  if (!poll || poll.groupId !== id) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (!isPollOpen(poll.status as GroupPollStatusValue, poll.closesAt)) {
    return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
  }

  // Members who haven't voted yet (exclude the organizer sending the reminder).
  const [members, voters] = await Promise.all([
    prisma.groupMember.findMany({ where: { groupId: id }, select: { residentId: true } }),
    prisma.groupPollVote.findMany({ where: { pollId }, select: { residentId: true } }),
  ]);
  const voted = new Set(voters.map((v) => v.residentId));
  const targets = members
    .map((m) => m.residentId)
    .filter((rid) => rid !== me.id && !voted.has(rid));

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  sendPushToResidents(targets, {
    title: `⏰ ${poll.group.name}`,
    body: `Reminder: vote for "${poll.title}"`,
    data: { type: "group_poll", id: pollId, groupId: id },
  }).catch(() => {});

  return NextResponse.json({ ok: true, reminded: targets.length });
}
