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
  MAX_ACTIVE_HABITS,
} from "@/lib/habits";

export const dynamic = "force-dynamic";

// Shape returned for the owner's own habits.
function serializeOwned(
  h: {
    id: string;
    title: string;
    emoji: string | null;
    targetMinutes: number | null;
    startDate: Date;
    endDate: Date;
    active: boolean;
    partnerStatus: string;
    partner: { id: string; name: string } | null;
    checkins: { date: Date }[];
  },
  today: string
) {
  const startYmd = istYmd(h.startDate);
  const endYmd = istYmd(h.endDate);
  const stats = computeStreaks(
    h.checkins.map((c) => c.date),
    startYmd,
    endYmd,
    today
  );
  return {
    id: h.id,
    role: "owner" as const,
    title: h.title,
    emoji: h.emoji,
    targetMinutes: h.targetMinutes,
    startDate: startYmd,
    endDate: endYmd,
    active: h.active,
    todayDone: h.checkins.some((c) => istYmd(c.date) === today),
    ...stats,
    partner: h.partner
      ? { id: h.partner.id, name: h.partner.name, status: h.partnerStatus }
      : null,
    checkinDates: h.checkins.map((c) => istYmd(c.date)),
  };
}

// GET /api/habits — owner's habits + accepted-partner habits + pending
// invites addressed to me. Partner view returns aggregates only, never the
// owner's raw check-in date list.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = istTodayYmd();

  const owned = await prisma.habit.findMany({
    where: { ownerId: me.id },
    include: {
      partner: { select: { id: true, name: true } },
      checkins: { select: { date: true } },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  // Habits where I'm the accepted partner — aggregates only.
  const partnering = await prisma.habit.findMany({
    where: { partnerId: me.id, partnerStatus: "accepted" },
    include: {
      owner: { select: { id: true, name: true, block: true, flatNumber: true } },
      checkins: { select: { date: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Pending invites addressed to me — minimal fields to render an accept card.
  const invites = await prisma.habit.findMany({
    where: { partnerId: me.id, partnerStatus: "pending" },
    include: { owner: { select: { name: true, block: true, flatNumber: true } } },
    orderBy: { createdAt: "desc" },
  });

  const nowMs = Date.now();

  return NextResponse.json({
    today,
    owned: owned.map((h) => serializeOwned(h, today)),
    partnering: partnering.map((h) => {
      const startYmd = istYmd(h.startDate);
      const endYmd = istYmd(h.endDate);
      const stats = computeStreaks(
        h.checkins.map((c) => c.date),
        startYmd,
        endYmd,
        today
      );
      const cooldownMs = 6 * 60 * 60 * 1000;
      const canNudge =
        !h.lastNudgedAt || nowMs - h.lastNudgedAt.getTime() >= cooldownMs;
      return {
        id: h.id,
        role: "partner" as const,
        title: h.title,
        emoji: h.emoji,
        startDate: startYmd,
        endDate: endYmd,
        active: h.active,
        todayDone: h.checkins.some((c) => istYmd(c.date) === today),
        ...stats,
        owner: {
          name: h.owner.name,
          block: h.owner.block,
          flatNumber: h.owner.flatNumber,
        },
        canNudge,
        nextNudgeAt: canNudge
          ? null
          : h.lastNudgedAt
            ? new Date(h.lastNudgedAt.getTime() + cooldownMs).toISOString()
            : null,
      };
    }),
    invites: invites.map((h) => ({
      id: h.id,
      title: h.title,
      emoji: h.emoji,
      ownerName: h.owner.name,
      ownerBlock: h.owner.block,
      ownerFlat: h.owner.flatNumber,
    })),
  });
}

// POST /api/habits — create a habit; optionally invite a partner.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { title, emoji, targetMinutes, startDate, endDate, partnerResidentId } =
    body as {
      title?: string;
      emoji?: string | null;
      targetMinutes?: number | null;
      startDate?: string;
      endDate?: string;
      partnerResidentId?: string | null;
    };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
    return NextResponse.json(
      { error: "Valid startDate and endDate (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 }
    );
  }

  // Active-habit cap.
  const activeCount = await prisma.habit.count({
    where: { ownerId: me.id, active: true },
  });
  if (activeCount >= MAX_ACTIVE_HABITS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_ACTIVE_HABITS} active habits` },
      { status: 400 }
    );
  }

  // Validate partner if provided.
  let partnerId: string | null = null;
  if (partnerResidentId) {
    if (partnerResidentId === me.id) {
      return NextResponse.json(
        { error: "You can't be your own accountability partner" },
        { status: 400 }
      );
    }
    const partner = await prisma.resident.findUnique({
      where: { id: partnerResidentId },
      select: { id: true, isApproved: true },
    });
    if (!partner || !partner.isApproved) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 400 }
      );
    }
    partnerId = partner.id;
  }

  const habit = await prisma.habit.create({
    data: {
      ownerId: me.id,
      title: title.trim(),
      emoji: emoji?.trim() || null,
      targetMinutes:
        typeof targetMinutes === "number" && targetMinutes > 0
          ? Math.trunc(targetMinutes)
          : null,
      startDate: ymdToInstant(startDate),
      endDate: ymdToInstant(endDate),
      partnerId,
      partnerStatus: partnerId ? "pending" : "none",
    },
  });

  // Fire partner invite push (best-effort).
  if (partnerId) {
    try {
      await sendPushToResidents([partnerId], {
        title: "👋 Accountability partner request",
        body: `${me.name} asked you to be their partner for "${habit.title}"`,
        data: { type: "habit_invite", id: habit.id },
      });
    } catch (err) {
      console.error("[habit invite push] failed:", err);
    }
  }

  return NextResponse.json({ id: habit.id }, { status: 201 });
}
