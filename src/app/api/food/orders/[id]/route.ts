import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import { isMenuManager } from "@/lib/food";

export const dynamic = "force-dynamic";

type Action =
  | "claim_paid"
  | "unclaim_paid"
  | "confirm_paid"
  | "unconfirm_paid"
  | "cancel";

// PATCH /api/food/orders/[id] — single endpoint, action-discriminated.
// Every transition is an atomic updateMany guarded on current state; a
// count of 0 means the guard failed (stale client / race) → 409.
//
//   Buyer  (order.buyerId === me):
//     claim_paid     PLACED|CONFIRMED, buyerPaid:false        → buyerPaid:true
//     unclaim_paid   buyerPaid:true AND chefPaid:false        → buyerPaid:false
//     cancel         status:PLACED                            → CANCELLED
//   Chef   (order.menu.chefId === me):
//     confirm_paid   buyerPaid:true AND chefPaid:false        → chefPaid:true (+CONFIRMED)
//     unconfirm_paid chefPaid:true                            → chefPaid:false
//     cancel         status != CANCELLED                      → CANCELLED
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action: Action = body?.action;
  if (
    !["claim_paid", "unclaim_paid", "confirm_paid", "unconfirm_paid", "cancel"].includes(
      action
    )
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Need to know my role relative to this order.
  const order = await prisma.foodOrder.findUnique({
    where: { id },
    select: {
      id: true,
      buyerId: true,
      menuId: true,
      menu: { select: { chefId: true, title: true, kind: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isBuyer = !!order.buyerId && order.buyerId === me.id;
  // The "chef side" of an order is the owner OR a nominated co-manager.
  const isChef =
    order.menu.chefId === me.id || (await isMenuManager(prisma, order.menuId, me.id));
  // Offline orders the chef logged manually have no buyer account — the chef
  // owns the whole payment lifecycle for those.
  const isManual = !order.buyerId;
  if (!isBuyer && !isChef) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  let where: Record<string, unknown> = { id };
  let data: Record<string, unknown> = {};
  let pushTo: string | null = null;
  let pushTitle = "";
  let pushBody = "";

  switch (action) {
    case "claim_paid":
      if (!isBuyer) return forbidden();
      where = { id, buyerId: me.id, buyerPaid: false, status: { not: "CANCELLED" } };
      data = { buyerPaid: true, buyerPaidAt: now };
      pushTo = order.menu.chefId;
      pushTitle = "💸 Buyer marked paid";
      pushBody = `${me.name} marked their order paid for "${order.menu.title}"`;
      break;

    case "unclaim_paid":
      if (!isBuyer) return forbidden();
      // Only while the chef hasn't confirmed.
      where = { id, buyerId: me.id, buyerPaid: true, chefPaid: false };
      data = { buyerPaid: false, buyerPaidAt: null };
      break;

    case "confirm_paid":
      if (!isChef) return forbidden();
      if (isManual) {
        // No buyer claim step — the chef marks the offline order settled.
        where = { id, chefPaid: false, status: { not: "CANCELLED" } };
        data = { buyerPaid: true, buyerPaidAt: now, chefPaid: true, chefPaidAt: now, status: "CONFIRMED" };
      } else {
        // Can only confirm a payment the buyer has claimed.
        where = { id, buyerPaid: true, chefPaid: false, status: { not: "CANCELLED" } };
        data = { chefPaid: true, chefPaidAt: now, status: "CONFIRMED" };
        pushTo = order.buyerId;
        pushTitle = "✅ Payment received";
        pushBody = `Your payment for "${order.menu.title}" was confirmed`;
      }
      break;

    case "unconfirm_paid":
      if (!isChef) return forbidden();
      if (isManual) {
        where = { id, chefPaid: true };
        data = { buyerPaid: false, buyerPaidAt: null, chefPaid: false, chefPaidAt: null, status: "PLACED" };
      } else {
        where = { id, chefPaid: true };
        data = { chefPaid: false, chefPaidAt: null };
      }
      break;

    case "cancel":
      if (isBuyer) {
        where = { id, buyerId: me.id, status: "PLACED" };
      } else {
        where = { id, status: { not: "CANCELLED" } };
      }
      data = { status: "CANCELLED", cancelledBy: isBuyer ? "buyer" : "chef" };
      pushTo = isBuyer ? order.menu.chefId : order.buyerId;
      pushTitle = "🚫 Order cancelled";
      pushBody = `An order for "${order.menu.title}" was cancelled`;
      break;
  }

  const res = await prisma.foodOrder.updateMany({ where, data });
  if (res.count === 0) {
    return NextResponse.json(
      { error: "That action isn't allowed right now" },
      { status: 409 }
    );
  }

  if (pushTo) {
    try {
      await sendPushToResidents([pushTo], {
        title: pushTitle,
        body: pushBody,
        // No id → mobile routes to the section's orders/stall tabs, the right
        // landing spot for an order status change. Branch by kind so a Bazaar
        // order lands on /bazaar, a Kitchen order on /food.
        data: {
          type: order.menu.kind === "MARKET" ? "market_order_update" : "food_order_update",
        },
      });
    } catch (err) {
      console.error("[food order update push] failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

function forbidden() {
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}
