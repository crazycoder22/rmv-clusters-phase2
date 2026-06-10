import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import { validateCart, round2, isMenuOrderable } from "@/lib/food";
import { KIND_LABELS, asKind } from "@/lib/market";

export const dynamic = "force-dynamic";

// POST /api/food/menus/[id]/orders — buyer places an order.
//
// The whole thing runs in a transaction: re-read the menu + each dish INSIDE
// the tx, recompute the total server-side from fresh prices, snapshot
// name/price per line. This closes the race where the chef edits prices or
// marks a dish sold-out while the buyer is checking out. Never trust a
// client-sent total.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { id: menuId } = await params;
  const body = await request.json().catch(() => null);
  const cart = validateCart(body?.items);
  if ("error" in cart) {
    return NextResponse.json({ error: cart.error }, { status: 400 });
  }
  const note: string | null =
    typeof body?.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const menu = await tx.foodMenu.findUnique({
        where: { id: menuId },
        select: { id: true, chefId: true, status: true, orderByAt: true, title: true, kind: true },
      });
      if (!menu) return { error: "Menu not found", code: 404 };
      if (menu.chefId === me.id) {
        return { error: "You can't order from your own menu", code: 400 };
      }
      if (!isMenuOrderable(menu.status, menu.orderByAt)) {
        return { error: "This menu is no longer taking orders", code: 409 };
      }

      // Re-read the exact dishes being ordered, fresh.
      const ids = cart.lines.map((l) => l.menuItemId);
      const dishes = await tx.foodMenuItem.findMany({
        where: { id: { in: ids }, menuId },
      });
      const byId = new Map(dishes.map((d) => [d.id, d]));

      const lineData: {
        menuItemId: string;
        nameSnapshot: string;
        priceSnapshot: number;
        unitSnapshot: string | null;
        qty: number;
      }[] = [];
      for (const line of cart.lines) {
        const dish = byId.get(line.menuItemId);
        if (!dish) return { error: "An item is no longer available", code: 409 };
        if (dish.soldOut) {
          return { error: `"${dish.name}" is sold out`, code: 409 };
        }
        lineData.push({
          menuItemId: dish.id,
          nameSnapshot: dish.name,
          priceSnapshot: dish.price,
          unitSnapshot: dish.unit,
          qty: line.qty,
        });
      }

      const total = round2(
        lineData.reduce((sum, l) => sum + l.priceSnapshot * l.qty, 0)
      );

      const order = await tx.foodOrder.create({
        data: {
          menuId,
          buyerId: me.id,
          note,
          totalAmount: total,
          items: { create: lineData },
        },
      });

      return { order, chefId: menu.chefId, menuTitle: menu.title, total, kind: menu.kind };
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.code }
      );
    }

    // Push the seller (best-effort, outside the tx). Copy + tap-route branch by kind.
    try {
      const isMarket = asKind(result.kind) === "MARKET";
      const count = cart.lines.reduce((s, l) => s + l.qty, 0);
      await sendPushToResidents([result.chefId], {
        title: KIND_LABELS[asKind(result.kind)].pushOrderTitle,
        body: `${me.name} ordered ${count} item${count !== 1 ? "s" : ""} (₹${result.total}) from "${result.menuTitle}"`,
        data: { type: isMarket ? "market_order" : "food_order", id: menuId },
      });
    } catch (err) {
      console.error("[food order push] failed:", err);
    }

    return NextResponse.json({ id: result.order.id }, { status: 201 });
  } catch (err) {
    console.error("[food order] failed:", err);
    return NextResponse.json({ error: "Could not place order" }, { status: 500 });
  }
}
