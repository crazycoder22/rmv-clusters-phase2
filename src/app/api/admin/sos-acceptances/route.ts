import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const acceptances = await prisma.sosAcceptance.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Manually resolve linked residents — include isSosWarrior so the mobile
  // admin can show a one-tap promote button without a second roundtrip.
  const residentIds = acceptances
    .map((a) => a.residentId)
    .filter((id): id is string => !!id);

  const residents =
    residentIds.length > 0
      ? await prisma.resident.findMany({
          where: { id: { in: residentIds } },
          select: {
            id: true,
            name: true,
            isSosWarrior: true,
            isApproved: true,
          },
        })
      : [];

  const residentMap = new Map(residents.map((r) => [r.id, r]));

  const result = acceptances.map((a) => ({
    ...a,
    resident: a.residentId ? residentMap.get(a.residentId) || null : null,
  }));

  return NextResponse.json({ acceptances: result });
}
