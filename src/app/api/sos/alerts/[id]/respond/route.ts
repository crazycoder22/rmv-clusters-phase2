import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { isWarrior } from "@/lib/sos";

// POST /api/sos/alerts/[id]/respond → warrior signals "I'm on my way" (idempotent).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isWarrior(me.id))) {
    return NextResponse.json({ error: "Only SOS warriors can respond" }, { status: 403 });
  }
  const { id } = await params;

  const alert = await prisma.sosAlert.findUnique({
    where: { id },
    select: { id: true, senderId: true, status: true },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  if (alert.status !== "ACTIVE") {
    return NextResponse.json({ error: "This SOS is already resolved" }, { status: 400 });
  }

  // Idempotent: only push the sender on the FIRST time this warrior responds.
  const existing = await prisma.sosResponse.findUnique({
    where: { alertId_responderId: { alertId: id, responderId: me.id } },
    select: { id: true },
  });
  if (!existing) {
    await prisma.sosResponse.create({ data: { alertId: id, responderId: me.id } });
    if (alert.senderId !== me.id) {
      sendPushToResidents([alert.senderId], {
        title: "🛡 Help is on the way",
        body: `${me.name} is coming to help.`,
        data: { type: "sos", id },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, myResponded: true });
}

// DELETE /api/sos/alerts/[id]/respond → warrior withdraws.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.sosResponse.deleteMany({ where: { alertId: id, responderId: me.id } });
  return NextResponse.json({ ok: true, myResponded: false });
}
