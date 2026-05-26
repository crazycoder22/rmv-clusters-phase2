import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST — Draw the next number (admin only).
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
  if (
    tambolaSession.status !== "WAITING" &&
    tambolaSession.status !== "ACTIVE"
  ) {
    return NextResponse.json(
      { error: "Session is not active" },
      { status: 400 }
    );
  }

  const drawnNumbers: number[] = JSON.parse(tambolaSession.drawnNumbers);
  const allNumbers = Array.from({ length: 90 }, (_, i) => i + 1);
  const remaining = allNumbers.filter((n) => !drawnNumbers.includes(n));

  if (remaining.length === 0) {
    return NextResponse.json(
      { error: "All numbers have been drawn" },
      { status: 400 }
    );
  }

  // Pick a random number from remaining
  const drawnNumber = remaining[Math.floor(Math.random() * remaining.length)];
  drawnNumbers.push(drawnNumber);

  // Update session: set ACTIVE if still WAITING
  await prisma.tambolaSession.update({
    where: { id: tambolaSession.id },
    data: {
      drawnNumbers: JSON.stringify(drawnNumbers),
      status: tambolaSession.status === "WAITING" ? "ACTIVE" : undefined,
    },
  });

  return NextResponse.json({
    drawnNumber,
    drawnNumbers,
    remaining: remaining.length - 1,
  });
}
