import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { validateCart, round2, isMenuManager } from "@/lib/food";

export const dynamic = "force-dynamic";

// POST /api/food/menus/[id]/manual-orders — the chef/seller logs an OFFLINE
// order (e.g. one that came in over WhatsApp from someone who doesn't use the
// app), so every order lives in one place. Chef-owner only.
//
// Body: { buyerName, items: [{ menuItemId, qty }], note?, paid? }
//   paid=true  → recorded as already settled (buyerPaid + chefPaid + CONFIRMED)
//   paid=false → PLACED, the chef can mark it paid later
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: menuId } = await params;
  const body = await request.json().catch(() => null);

  const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 80) : "";
  if (!buyerName) {
    return NextResponse.json({ error: "Who is this order for?" }, { status: 400 });
  }
  const cart = validateCart(body?.items);
  if ("error" in cart) {
    return NextResponse.json({ error: cart.error }, { status: 400 });
  }
  const note: string | null =
    typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const paid = body?.paid === true;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const menu = await tx.foodMenu.findUnique({
        where: { id: menuId },
        select: { id: true, chefId: true, status: true },
      });
      if (!menu) return { error: "Not found", code: 404 };
      // Owner or a nominated co-manager can log offline orders.
      if (menu.chefId !== me.id && !(await isMenuManager(tx, menuId, me.id))) {
        return { error: "Not allowed", code: 403 };
      }
      if (menu.status === "ARCHIVED") return { error: "This listing is archived", code: 409 };

      const ids = cart.lines.map((l) => l.menuItemId);
      const dishes = await tx.foodMenuItem.findMany({ where: { id: { in: ids }, menuId } });
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
        lineData.push({
          menuItemId: dish.id,
          nameSnapshot: dish.name,
          priceSnapshot: dish.price,
          unitSnapshot: dish.unit,
          qty: line.qty,
        });
      }

      const total = round2(lineData.reduce((s, l) => s + l.priceSnapshot * l.qty, 0));
      const now = new Date();

      const order = await tx.foodOrder.create({
        data: {
          menuId,
          buyerId: null,
          manualBuyerName: buyerName,
          note,
          totalAmount: total,
          // Mirror the offline payment state the chef knows about.
          buyerPaid: paid,
          buyerPaidAt: paid ? now : null,
          chefPaid: paid,
          chefPaidAt: paid ? now : null,
          status: paid ? "CONFIRMED" : "PLACED",
          items: { create: lineData },
        },
      });
      return { id: order.id };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.code });
    }
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err) {
    console.error("[manual order] failed:", err);
    return NextResponse.json({ error: "Could not add order" }, { status: 500 });
  }
}
