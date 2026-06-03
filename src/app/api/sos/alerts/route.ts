import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { isWarrior, warriorIds, MAX_NOTE } from "@/lib/sos";

export const dynamic = "force-dynamic";

// POST /api/sos/alerts → raise an SOS (any approved resident).
// Cooldown: one ACTIVE alert per sender at a time.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.sosAlert.findFirst({
    where: { senderId: me.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active SOS", id: existing.id },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, MAX_NOTE) || null : null;

  const alert = await prisma.sosAlert.create({
    data: {
      senderId: me.id,
      senderName: me.name,
      senderBlock: me.block,
      senderFlat: me.flatNumber,
      senderPhone: me.phone,
      note,
    },
  });

  // Broadcast to all warriors (best-effort).
  const targets = await warriorIds();
  if (targets.length > 0) {
    sendPushToResidents(targets, {
      title: `🚨 SOS from ${me.name}`,
      body: `Block ${me.block}, Flat ${me.flatNumber} needs help — tap to respond${note ? ` · ${note}` : ""}`,
      data: { type: "sos", id: alert.id },
      sound: "default",
    }).catch(() => {});
  }

  return NextResponse.json({ id: alert.id, warriorsNotified: targets.length }, { status: 201 });
}

// GET /api/sos/alerts → for warriors: all ACTIVE alerts; for everyone: my own active alert.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const warrior = await isWarrior(me.id);

  const alerts = await prisma.sosAlert.findMany({
    where: warrior
      ? { status: "ACTIVE" }
      : { senderId: me.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { responses: true } },
      responses: { where: { responderId: me.id }, select: { id: true } },
    },
  });

  return NextResponse.json({
    amWarrior: warrior,
    alerts: alerts.map((a) => ({
      id: a.id,
      senderName: a.senderName,
      senderBlock: a.senderBlock,
      senderFlat: a.senderFlat,
      note: a.note,
      amSender: a.senderId === me.id,
      responderCount: a._count.responses,
      myResponded: a.responses.length > 0,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}
