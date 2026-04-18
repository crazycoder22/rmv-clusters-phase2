import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── GET /api/medals ─────────────────────────────────────────────────────────
// Lists awards. Admins (canManageAnnouncements) can list any recipient's awards
// (or all awards if recipientId is omitted). Non-admins can only list their own.
//
// Query params:
//   - recipientId  (optional)  — filter to one recipient
//   - limit        (optional)  — default 50, max 200
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!me) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const recipientId = searchParams.get("recipientId");
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "50", 10) || 50,
    200
  );

  const isAdmin = canManageAnnouncements(session.user.roles);

  // Non-admins can only see their own awards.
  if (!isAdmin) {
    if (recipientId && recipientId !== me.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const where = recipientId
    ? { recipientId }
    : isAdmin
    ? {}
    : { recipientId: me.id };

  const awards = await prisma.medalAward.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      recipient: {
        select: { id: true, name: true, block: true, flatNumber: true },
      },
      awardedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ awards });
}

// ── POST /api/medals ────────────────────────────────────────────────────────
// Create a new award. Admin only. Also creates an in-app notification for the
// recipient in the same transaction.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const awardedBy = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!awardedBy) {
    return NextResponse.json({ error: "Admin resident not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { recipientId, game, tier, coins, reason } = body as {
    recipientId?: string;
    game?: string;
    tier?: string;
    coins?: number;
    reason?: string | null;
  };

  // Validate required fields
  if (!recipientId || !game?.trim() || !tier) {
    return NextResponse.json(
      { error: "recipientId, game, and tier are required" },
      { status: 400 }
    );
  }
  if (!["GOLD", "SILVER", "BRONZE"].includes(tier)) {
    return NextResponse.json(
      { error: "tier must be GOLD, SILVER, or BRONZE" },
      { status: 400 }
    );
  }
  const coinsInt = Math.floor(Number(coins ?? 0));
  if (!Number.isFinite(coinsInt) || coinsInt < 0 || coinsInt > 100000) {
    return NextResponse.json(
      { error: "coins must be a non-negative integer ≤ 100000" },
      { status: 400 }
    );
  }

  // Check recipient exists
  const recipient = await prisma.resident.findUnique({
    where: { id: recipientId },
    select: { id: true, name: true },
  });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  // Create award + notification in a single transaction so we never end up
  // with an award and no notification, or vice versa.
  const tierLabel = tier === "GOLD" ? "Gold" : tier === "SILVER" ? "Silver" : "Bronze";
  const award = await prisma.$transaction(async (tx) => {
    const created = await tx.medalAward.create({
      data: {
        recipientId,
        game: game.trim(),
        tier: tier as "GOLD" | "SILVER" | "BRONZE",
        coins: coinsInt,
        reason: reason?.trim() || null,
        awardedById: awardedBy.id,
      },
    });

    await tx.notification.create({
      data: {
        residentId: recipientId,
        medalAwardId: created.id,
        message: `🏆 You won a ${tierLabel} medal in ${game.trim()}! +${coinsInt} coins`,
      },
    });

    return created;
  });

  return NextResponse.json({ award }, { status: 201 });
}
