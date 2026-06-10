import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/food/orders — the caller's own orders (buyer view), across menus.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.foodOrder.findMany({
    where: { buyerId: me.id },
    include: {
      items: true,
      menu: {
        select: {
          id: true,
          title: true,
          kind: true,
          pickupInfo: true,
          chef: { select: { name: true, block: true, flatNumber: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      menuId: o.menu.id,
      menuTitle: o.menu.title,
      kind: o.menu.kind,
      pickupInfo: o.menu.pickupInfo,
      chef: o.menu.chef,
      status: o.status,
      note: o.note,
      totalAmount: o.totalAmount,
      buyerPaid: o.buyerPaid,
      chefPaid: o.chefPaid,
      createdAt: o.createdAt,
      items: o.items.map((li) => ({
        name: li.nameSnapshot,
        price: li.priceSnapshot,
        unit: li.unitSnapshot,
        qty: li.qty,
      })),
    })),
  });
}
