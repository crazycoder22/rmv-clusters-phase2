import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST — End a Tambola session (admin only).
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

  const tambolaSession = await prisma.tambolaSession.findUnique({
    where: { code },
  });
  if (!tambolaSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (tambolaSession.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Session is already completed" },
      { status: 400 }
    );
  }

  await prisma.tambolaSession.update({
    where: { id: tambolaSession.id },
    data: { status: "COMPLETED" },
  });

  return NextResponse.json({ success: true });
}
