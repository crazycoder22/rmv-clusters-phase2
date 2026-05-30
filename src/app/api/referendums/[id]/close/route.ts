import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

// POST /api/referendums/[id]/close — committee closes voting early.
// Terminal: there is intentionally NO endpoint to reopen a referendum.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Only committee members can close a referendum" }, { status: 403 });
  }
  const { id } = await params;

  // Atomic guard: only an OPEN referendum flips to CLOSED, exactly once.
  const result = await prisma.referendum.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date(), closedById: me.id },
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: "Referendum is already closed" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
