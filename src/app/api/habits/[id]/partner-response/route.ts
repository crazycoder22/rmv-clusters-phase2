import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/habits/[id]/partner-response — invited partner accepts/declines.
// Body: { action: "accept" | "decline" }
//
// The transition is an atomic check-and-set: updateMany guarded on
// (partnerId === me.id AND partnerStatus === "pending"). If count === 0 the
// invite was rescinded / re-assigned / already answered — we report 409 so
// stale clients don't think they succeeded.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'decline'" },
      { status: 400 }
    );
  }

  const nextStatus = action === "accept" ? "accepted" : "declined";
  const result = await prisma.habit.updateMany({
    where: { id, partnerId: me.id, partnerStatus: "pending" },
    data: { partnerStatus: nextStatus },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "This invite is no longer pending" },
      { status: 409 }
    );
  }

  // On accept, tell the owner. Best-effort.
  if (action === "accept") {
    const habit = await prisma.habit.findUnique({
      where: { id },
      select: { ownerId: true, title: true },
    });
    if (habit) {
      try {
        await sendPushToResidents([habit.ownerId], {
          title: "🤝 Partner accepted",
          body: `${me.name} is now your accountability partner for "${habit.title}"`,
          data: { type: "habit_accepted", id },
        });
      } catch (err) {
        console.error("[habit accepted push] failed:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
