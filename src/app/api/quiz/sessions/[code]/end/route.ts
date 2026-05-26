import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST — End the quiz session (admin).
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const me = await getAuthedResident(request);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(me.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.quizSession.update({
    where: { code },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ status: "COMPLETED" });
}
