import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/popups — returns the latest active popup (public, no auth)
export async function GET() {
  const now = new Date();

  const popup = await prisma.sitePopup.findFirst({
    where: {
      active: true,
      startsAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, message: true },
  });

  return NextResponse.json({ popup });
}
