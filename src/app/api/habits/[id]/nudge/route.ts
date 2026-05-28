import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import { NUDGE_COOLDOWN_MS } from "@/lib/habits";

export const dynamic = "force-dynamic";

// POST /api/habits/[id]/nudge — accepted partner pings the owner.
// Rate-limited to once per NUDGE_COOLDOWN_MS via the atomic updateMany guard
// on lastNudgedAt: only succeeds if no nudge in the cooldown window. This
// doubles as the authz check (partnerId === me.id AND accepted).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // First confirm I'm the accepted partner (separate from the rate-limit so
  // we can return the right status code).
  const habit = await prisma.habit.findUnique({
    where: { id },
    select: {
      ownerId: true,
      title: true,
      partnerId: true,
      partnerStatus: true,
      lastNudgedAt: true,
    },
  });
  if (
    !habit ||
    habit.partnerId !== me.id ||
    habit.partnerStatus !== "accepted"
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cutoff = new Date(Date.now() - NUDGE_COOLDOWN_MS);
  // Atomic rate-limit: only update if lastNudgedAt is null or older than the
  // cooldown. count===0 means someone nudged within the window.
  const result = await prisma.habit.updateMany({
    where: {
      id,
      partnerId: me.id,
      partnerStatus: "accepted",
      OR: [{ lastNudgedAt: null }, { lastNudgedAt: { lt: cutoff } }],
    },
    data: { lastNudgedAt: new Date() },
  });

  if (result.count === 0) {
    const nextAt = habit.lastNudgedAt
      ? new Date(habit.lastNudgedAt.getTime() + NUDGE_COOLDOWN_MS)
      : null;
    return NextResponse.json(
      { error: "You've already nudged recently", nextNudgeAt: nextAt },
      { status: 429 }
    );
  }

  try {
    await sendPushToResidents([habit.ownerId], {
      title: "👋 A nudge from your partner",
      body: `${me.name}: don't forget "${habit.title}" today!`,
      data: { type: "habit_nudge", id },
    });
  } catch (err) {
    console.error("[habit nudge push] failed:", err);
  }

  return NextResponse.json({ ok: true });
}
