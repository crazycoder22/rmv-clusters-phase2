import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isWarrior } from "@/lib/sos";

export const dynamic = "force-dynamic";

// GET /api/sos/alerts/[id] → detail. Visible only to the sender or a warrior.
// Phone is included only for these authorized parties.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const alert = await prisma.sosAlert.findUnique({
    where: { id },
    include: {
      responses: {
        orderBy: { createdAt: "asc" },
        include: { responder: { select: { name: true, block: true, flatNumber: true } } },
      },
    },
  });
  if (!alert) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  const amSender = alert.senderId === me.id;
  const warrior = await isWarrior(me.id);
  // Leak guard: only the sender or a warrior may view an alert.
  if (!amSender && !warrior) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: alert.id,
    senderName: alert.senderName,
    senderBlock: alert.senderBlock,
    senderFlat: alert.senderFlat,
    senderPhone: alert.senderPhone, // authorized parties only (sender/warrior)
    note: alert.note,
    status: alert.status,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    amSender,
    amWarrior: warrior,
    myResponded: alert.responses.some((r) => r.responderId === me.id),
    responders: alert.responses.map((r) => ({
      name: r.responder.name,
      block: r.responder.block,
      flatNumber: r.responder.flatNumber,
      respondedAt: r.createdAt.toISOString(),
    })),
  });
}
