import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import {
  computeStreaks,
  istTodayYmd,
  istYmd,
  ymdToInstant,
  isValidYmd,
} from "@/lib/habits";

export const dynamic = "force-dynamic";

// GET /api/habits/[id] — single habit for the detail page. Visible to the
// owner OR an accepted partner. Owner gets full check-in list; partner gets
// aggregates only (no raw check-in dates). 404 for anyone else (don't leak).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, block: true, flatNumber: true } },
      partner: { select: { id: true, name: true } },
      checkins: { select: { date: true } },
    },
  });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = habit.ownerId === me.id;
  const isAcceptedPartner =
    habit.partnerId === me.id && habit.partnerStatus === "accepted";
  if (!isOwner && !isAcceptedPartner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const today = istTodayYmd();
  const startYmd = istYmd(habit.startDate);
  const endYmd = istYmd(habit.endDate);
  const stats = computeStreaks(
    habit.checkins.map((c) => c.date),
    startYmd,
    endYmd,
    today
  );
  const cooldownMs = 6 * 60 * 60 * 1000;
  const canNudge =
    isAcceptedPartner &&
    (!habit.lastNudgedAt ||
      Date.now() - habit.lastNudgedAt.getTime() >= cooldownMs);

  return NextResponse.json({
    id: habit.id,
    role: isOwner ? "owner" : "partner",
    title: habit.title,
    emoji: habit.emoji,
    targetMinutes: habit.targetMinutes,
    startDate: startYmd,
    endDate: endYmd,
    active: habit.active,
    today,
    todayDone: habit.checkins.some((c) => istYmd(c.date) === today),
    ...stats,
    // Owner sees the full marked-day list (to render the grid); partner sees
    // only the aggregate streaks above.
    checkinDates: isOwner ? habit.checkins.map((c) => istYmd(c.date)) : [],
    owner: { name: habit.owner.name, block: habit.owner.block, flatNumber: habit.owner.flatNumber },
    partner: habit.partner
      ? { id: habit.partner.id, name: habit.partner.name, status: habit.partnerStatus }
      : null,
    canNudge,
  });
}

// PATCH /api/habits/[id] — owner-only edit. Can change title/emoji/dates/
// target/active and add/change/remove the partner. Changing the partner
// resets the invite state + nudge clock.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== me.id) {
    // 404 rather than 403 so we don't reveal a habit exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim())
    data.title = body.title.trim();
  if (body.emoji !== undefined) data.emoji = body.emoji?.trim() || null;
  if (body.targetMinutes !== undefined)
    data.targetMinutes =
      typeof body.targetMinutes === "number" && body.targetMinutes > 0
        ? Math.trunc(body.targetMinutes)
        : null;
  if (typeof body.active === "boolean") data.active = body.active;

  // Date edits — validate together.
  const newStart = body.startDate ?? istYmd(existing.startDate);
  const newEnd = body.endDate ?? istYmd(existing.endDate);
  if (body.startDate !== undefined || body.endDate !== undefined) {
    if (!isValidYmd(newStart) || !isValidYmd(newEnd) || newEnd < newStart) {
      return NextResponse.json(
        { error: "Invalid date range" },
        { status: 400 }
      );
    }
    data.startDate = ymdToInstant(newStart);
    data.endDate = ymdToInstant(newEnd);
  }

  // Partner change. `partnerResidentId: null` removes the partner.
  let invitedPartnerId: string | null = null;
  if (body.partnerResidentId !== undefined) {
    const next: string | null = body.partnerResidentId;
    if (next === null) {
      data.partnerId = null;
      data.partnerStatus = "none";
      data.lastNudgedAt = null;
    } else {
      if (next === me.id) {
        return NextResponse.json(
          { error: "You can't be your own partner" },
          { status: 400 }
        );
      }
      if (next !== existing.partnerId) {
        const partner = await prisma.resident.findUnique({
          where: { id: next },
          select: { id: true, isApproved: true },
        });
        if (!partner || !partner.isApproved) {
          return NextResponse.json(
            { error: "Partner not found" },
            { status: 400 }
          );
        }
        data.partnerId = partner.id;
        data.partnerStatus = "pending";
        data.lastNudgedAt = null;
        invitedPartnerId = partner.id;
      }
    }
  }

  const updated = await prisma.habit.update({ where: { id }, data });

  if (invitedPartnerId) {
    try {
      await sendPushToResidents([invitedPartnerId], {
        title: "👋 Accountability partner request",
        body: `${me.name} asked you to be their partner for "${updated.title}"`,
        data: { type: "habit_invite", id: updated.id },
      });
    } catch (err) {
      console.error("[habit invite push] failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/habits/[id] — owner-only. Cascade removes check-ins.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scope the delete to the owner in one atomic query.
  const res = await prisma.habit.deleteMany({
    where: { id, ownerId: me.id },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
