import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isPollOpen, type GroupPollStatusValue } from "@/lib/groups";
import { myMembership } from "@/lib/group-auth";

// POST /api/groups/[id]/polls/[pollId]/vote {optionId} → member casts/changes vote
export async function POST(request: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pollId } = await params;

  // Must be a member of the group to vote.
  const membership = await myMembership(id, me.id);
  if (!membership) return NextResponse.json({ error: "Join the group to vote" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!optionId) return NextResponse.json({ error: "Choose an option" }, { status: 400 });

  const poll = await prisma.groupPoll.findUnique({
    where: { id: pollId },
    select: { groupId: true, status: true, closesAt: true, options: { select: { id: true } } },
  });
  if (!poll || poll.groupId !== id) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  if (!isPollOpen(poll.status as GroupPollStatusValue, poll.closesAt)) {
    return NextResponse.json({ error: "Voting is closed" }, { status: 400 });
  }
  if (!poll.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: "Invalid option" }, { status: 400 });
  }

  // Upsert — one vote per member, changeable while open.
  await prisma.groupPollVote.upsert({
    where: { pollId_residentId: { pollId, residentId: me.id } },
    create: { pollId, optionId, residentId: me.id },
    update: { optionId },
  });

  return NextResponse.json({ ok: true });
}
