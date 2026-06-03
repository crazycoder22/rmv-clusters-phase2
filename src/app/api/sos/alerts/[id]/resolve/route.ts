import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { isWarrior } from "@/lib/sos";

// POST /api/sos/alerts/[id]/resolve → sender OR any warrior marks it resolved.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const alert = await prisma.sosAlert.findUnique({
    where: { id },
    select: { id: true, senderId: true, status: true, responses: { select: { responderId: true } } },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  const amSender = alert.senderId === me.id;
  const warrior = await isWarrior(me.id);
  if (!amSender && !warrior) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Atomic OPEN→RESOLVED.
  const res = await prisma.sosAlert.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: me.id },
  });
  if (res.count !== 1) {
    return NextResponse.json({ error: "This SOS is already resolved" }, { status: 409 });
  }

  // Notify sender + all responders (minus whoever resolved it).
  const notify = new Set<string>([alert.senderId, ...alert.responses.map((r) => r.responderId)]);
  notify.delete(me.id);
  if (notify.size > 0) {
    sendPushToResidents([...notify], {
      title: "✅ SOS resolved",
      body: `${me.name} marked the SOS as resolved.`,
      data: { type: "sos", id },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: "RESOLVED" });
}
