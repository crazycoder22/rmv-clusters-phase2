import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── GET /api/medals/me ──────────────────────────────────────────────────────
// Aggregated tally for the current user, used by the navbar chip and the
// /me/awards page.
//
// Returns:
//   {
//     goldCount, silverCount, bronzeCount,
//     totalMedals, totalCoins,
//     recent: [...5 most recent awards with game + tier + coins + when]
//   }
//
// Returns zeros for residents with no awards (instead of 404) so the chip
// can decide whether to render based on the totals.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) {
    // Not a registered resident → return empty rather than erroring; the
    // chip just won't render.
    return NextResponse.json({
      goldCount: 0,
      silverCount: 0,
      bronzeCount: 0,
      totalMedals: 0,
      totalCoins: 0,
      recent: [],
    });
  }

  // One pass: fetch all awards (community size means this is small).
  const awards = await prisma.medalAward.findMany({
    where: { recipientId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      game: true,
      tier: true,
      coins: true,
      reason: true,
      createdAt: true,
    },
  });

  let goldCount = 0;
  let silverCount = 0;
  let bronzeCount = 0;
  let totalCoins = 0;
  for (const a of awards) {
    if (a.tier === "GOLD") goldCount += 1;
    else if (a.tier === "SILVER") silverCount += 1;
    else if (a.tier === "BRONZE") bronzeCount += 1;
    totalCoins += a.coins;
  }

  return NextResponse.json({
    goldCount,
    silverCount,
    bronzeCount,
    totalMedals: goldCount + silverCount + bronzeCount,
    totalCoins,
    recent: awards.slice(0, 5),
    all: awards, // /me/awards page uses this; navbar chip ignores it
  });
}
