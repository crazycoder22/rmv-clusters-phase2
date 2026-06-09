import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";

export const dynamic = "force-dynamic";

const RUN_KEYS = [
  "run5kGoal",
  "run10kGoal",
  "run20kGoal",
  "run5kDone",
  "run10kDone",
  "run20kDone",
] as const;

function clampRun(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 999);
}

// Resolve announcement → eventConfig → caller's RSVP.
async function resolve(announcementId: string, residentId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: { eventConfig: { select: { id: true, stepTrackingEnabled: true } } },
  });
  if (!announcement?.eventConfig?.stepTrackingEnabled) return null;
  const rsvp = await prisma.rsvp.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId,
      },
    },
    select: { id: true },
  });
  return { eventConfigId: announcement.eventConfig.id, rsvpId: rsvp?.id ?? null };
}

// GET /api/events/[id]/challenge → my run goals + partner + any incoming invite.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await resolve(id, me.id);
  if (!r) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const goal = r.rsvpId
    ? await prisma.stepChallengeGoal.findUnique({
        where: { rsvpId: r.rsvpId },
        include: { partner: { select: { id: true, name: true, block: true, flatNumber: true } } },
      })
    : null;

  // Invites where I'm the chosen partner (pending) for this event.
  const invite = await prisma.stepChallengeGoal.findFirst({
    where: { eventConfigId: r.eventConfigId, partnerId: me.id, partnerStatus: "pending" },
    include: { rsvp: { select: { resident: { select: { id: true, name: true, block: true, flatNumber: true } } } } },
  });

  return NextResponse.json({
    registered: !!r.rsvpId,
    goal: goal
      ? {
          run5kGoal: goal.run5kGoal,
          run10kGoal: goal.run10kGoal,
          run20kGoal: goal.run20kGoal,
          run5kDone: goal.run5kDone,
          run10kDone: goal.run10kDone,
          run20kDone: goal.run20kDone,
          partner: goal.partner
            ? { ...goal.partner, status: goal.partnerStatus }
            : null,
        }
      : null,
    incomingInvite: invite
      ? { goalId: invite.id, from: invite.rsvp.resident }
      : null,
  });
}

// PUT /api/events/[id]/challenge → upsert my run goals/done + optional partner.
// Body: { run5kGoal, run10kGoal, run20kGoal, run5kDone, run10kDone, run20kDone,
//         partnerResidentId?: string | null }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await resolve(id, me.id);
  if (!r) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!r.rsvpId) {
    return NextResponse.json(
      { error: "Register for the challenge first" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const runData: Record<string, number> = {};
  for (const k of RUN_KEYS) runData[k] = clampRun(body?.[k]);

  // Resolve partner (optional). Reject self; validate the resident exists.
  let partnerId: string | null = null;
  if (typeof body?.partnerResidentId === "string" && body.partnerResidentId) {
    if (body.partnerResidentId === me.id) {
      return NextResponse.json({ error: "You can't pick yourself" }, { status: 400 });
    }
    const partner = await prisma.resident.findUnique({
      where: { id: body.partnerResidentId },
      select: { id: true },
    });
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 400 });
    }
    partnerId = partner.id;
  }

  const existing = await prisma.stepChallengeGoal.findUnique({
    where: { rsvpId: r.rsvpId },
    select: { partnerId: true, partnerStatus: true },
  });

  // Decide partner status: new partner → pending (+push); unchanged → keep;
  // cleared → none.
  let partnerStatus: "none" | "pending" | "accepted" | "declined" = "none";
  let notifyNewPartner = false;
  if (partnerId) {
    if (existing && existing.partnerId === partnerId && existing.partnerStatus !== "none") {
      partnerStatus = existing.partnerStatus as typeof partnerStatus;
    } else {
      partnerStatus = "pending";
      notifyNewPartner = true;
    }
  }

  const saved = await prisma.stepChallengeGoal.upsert({
    where: { rsvpId: r.rsvpId },
    create: {
      eventConfigId: r.eventConfigId,
      rsvpId: r.rsvpId,
      ...runData,
      partnerId,
      partnerStatus,
    },
    update: { ...runData, partnerId, partnerStatus },
  });

  if (notifyNewPartner && partnerId) {
    void sendPushToResidents([partnerId], {
      title: "🏃 Step-Up partner request",
      body: `${me.name} wants you as their Mini Step-Up accountability partner`,
      data: { type: "step_challenge", id },
    });
  }

  return NextResponse.json({ ok: true, id: saved.id });
}
