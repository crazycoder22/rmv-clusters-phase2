import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/events/[id]/challenge/partner-response  { action: "accept" | "decline" }
// The invited partner accepts/declines a Mini Step-Up accountability request.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "action must be accept|decline" }, { status: 400 });
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { eventConfig: { select: { id: true } } },
  });
  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const goal = await prisma.stepChallengeGoal.findFirst({
    where: {
      eventConfigId: announcement.eventConfig.id,
      partnerId: me.id,
      partnerStatus: "pending",
    },
    include: { rsvp: { select: { residentId: true } } },
  });
  if (!goal) return NextResponse.json({ ok: true, updated: 0 });

  await prisma.stepChallengeGoal.update({
    where: { id: goal.id },
    data: { partnerStatus: action === "accept" ? "accepted" : "declined" },
  });

  if (action === "accept") {
    void sendPushToResidents([goal.rsvp.residentId], {
      title: "🤝 Partner accepted",
      body: `${me.name} is now your Mini Step-Up accountability partner`,
      data: { type: "step_challenge", id },
    });
  }

  return NextResponse.json({ ok: true });
}
