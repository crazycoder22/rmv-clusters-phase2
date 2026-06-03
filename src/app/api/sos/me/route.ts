import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isWarrior } from "@/lib/sos";

export const dynamic = "force-dynamic";

// GET /api/sos/me → cheap home-screen state: am I a warrior + is there an alert
// I should see (a warrior sees ANY active alert; everyone sees their own).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const warrior = await isWarrior(me.id);

  // My own active alert (sender side).
  const mine = await prisma.sosAlert.findFirst({
    where: { senderId: me.id, status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  // For warriors: the most recent active alert anywhere (to surface the banner).
  let warriorAlertId: string | null = null;
  let warriorActiveCount = 0;
  if (warrior) {
    const active = await prisma.sosAlert.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    warriorActiveCount = active.length;
    warriorAlertId = active[0]?.id ?? null;
  }

  return NextResponse.json({
    amWarrior: warrior,
    myActiveAlertId: mine?.id ?? null,
    warriorActiveAlertId: warriorAlertId,
    warriorActiveCount,
  });
}
