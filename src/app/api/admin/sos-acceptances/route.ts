import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const acceptances = await prisma.sosAcceptance.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Manually resolve linked residents
  const residentIds = acceptances
    .map((a) => a.residentId)
    .filter((id): id is string => !!id);

  const residents =
    residentIds.length > 0
      ? await prisma.resident.findMany({
          where: { id: { in: residentIds } },
          select: { id: true, name: true },
        })
      : [];

  const residentMap = new Map(residents.map((r) => [r.id, r]));

  const result = acceptances.map((a) => ({
    ...a,
    resident: a.residentId ? residentMap.get(a.residentId) || null : null,
  }));

  return NextResponse.json({ acceptances: result });
}
