import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { MAX_CLOSE_NOTE } from "@/lib/groups";
import { isOrganizer } from "@/lib/group-auth";

// POST /api/groups/[id]/polls/[pollId]/close {outcome, note?} → organizer closes
// the poll with an outcome (GAME_ON / CANCELLED) + optional note, pushes members.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, pollId } = await params;
  if (!(await isOrganizer(id, me.id))) return NextResponse.json({ error: "Only organizers can close polls" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const outcome = body?.outcome === "GAME_ON" ? "GAME_ON" : body?.outcome === "CANCELLED" ? "CANCELLED" : null;
  if (!outcome) return NextResponse.json({ error: "Pick an outcome" }, { status: 400 });
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_CLOSE_NOTE) : null;

  const poll = await prisma.groupPoll.findUnique({
    where: { id: pollId },
    select: { groupId: true, title: true, group: { select: { name: true } } },
  });
  if (!poll || poll.groupId !== id) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  // Atomic OPEN→CLOSED.
  const result = await prisma.groupPoll.updateMany({
    where: { id: pollId, status: "OPEN" },
    data: { status: "CLOSED", outcome, closeNote: note, closedAt: new Date() },
  });
  if (result.count !== 1) return NextResponse.json({ error: "Poll is already closed" }, { status: 409 });

  // Push all members (except the closer).
  const members = await prisma.groupMember.findMany({
    where: { groupId: id, residentId: { not: me.id } },
    select: { residentId: true },
  });
  if (members.length) {
    const headline = outcome === "GAME_ON" ? "🟢 Game ON" : "🔴 Cancelled";
    const body2 = note ? `${poll.title} — ${headline}: ${note}` : `${poll.title} — ${headline}`;
    sendPushToResidents(members.map((m) => m.residentId), {
      title: `🏐 ${poll.group.name}`,
      body: body2,
      data: { type: "group_poll", id: pollId, groupId: id },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
