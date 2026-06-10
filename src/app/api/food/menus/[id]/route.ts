import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { round2, isMenuOrderable } from "@/lib/food";
import { MARKET_UNIT_VALUES } from "@/lib/market";

export const dynamic = "force-dynamic";

// GET /api/food/menus/[id] — detail.
//   Chef-owner: full menu + items + ALL orders (with buyer contact).
//   Anyone else: menu + items + ONLY the caller's own order(s).
// Never serve other buyers' orders/contact to a non-chef.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const menu = await prisma.foodMenu.findUnique({
    where: { id },
    include: {
      chef: { select: { id: true, name: true, block: true, flatNumber: true, phone: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!menu || menu.status === "ARCHIVED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isChef = menu.chefId === me.id;

  // Whether the caller (a buyer) follows this chef — drives the Follow toggle.
  const following = isChef
    ? false
    : (await prisma.chefFollow.count({
        where: { chefId: menu.chefId, followerId: me.id },
      })) > 0;

  // Orders — scoped by role.
  const orders = await prisma.foodOrder.findMany({
    where: isChef ? { menuId: id } : { menuId: id, buyerId: me.id },
    include: {
      items: true,
      buyer: isChef
        ? { select: { id: true, name: true, block: true, flatNumber: true, phone: true } }
        : false,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: menu.id,
    title: menu.title,
    description: menu.description,
    date: menu.date,
    orderByAt: menu.orderByAt,
    pickupInfo: menu.pickupInfo,
    status: menu.status,
    kind: menu.kind,
    orderable: isMenuOrderable(menu.status, menu.orderByAt),
    role: isChef ? "chef" : "buyer",
    chef: {
      id: menu.chef.id,
      name: menu.chef.name,
      block: menu.chef.block,
      flatNumber: menu.chef.flatNumber,
      // Phone only exposed to buyers so they can coordinate pickup/payment.
      phone: isChef ? null : menu.chef.phone,
      isMe: isChef,
      following,
    },
    items: menu.items.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      price: it.price,
      unit: it.unit,
      imageUrl: it.imageUrl,
      soldOut: it.soldOut,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      note: o.note,
      totalAmount: o.totalAmount,
      buyerPaid: o.buyerPaid,
      buyerPaidAt: o.buyerPaidAt,
      chefPaid: o.chefPaid,
      chefPaidAt: o.chefPaidAt,
      createdAt: o.createdAt,
      items: o.items.map((li) => ({
        name: li.nameSnapshot,
        price: li.priceSnapshot,
        unit: li.unitSnapshot,
        qty: li.qty,
      })),
      // buyer object only present for chef view
      buyer:
        isChef && "buyer" in o && o.buyer
          ? {
              name: o.buyer.name,
              block: o.buyer.block,
              flatNumber: o.buyer.flatNumber,
              phone: o.buyer.phone,
            }
          : undefined,
    })),
  });
}

// PATCH /api/food/menus/[id] — chef-owner edits.
// Body may include: title, description, pickupInfo, orderByAt, status
// ("OPEN"|"CLOSED"), and items[] (full replace of dish fields by id:
// { id?, name, description, price, imageUrl, soldOut }). New items (no id)
// are created; omitted existing items are deleted UNLESS referenced by an
// order (we just mark soldOut to preserve them — handled by SetNull on FK).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const menu = await prisma.foodMenu.findUnique({ where: { id } });
  if (!menu || menu.chefId !== me.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim())
    data.title = body.title.trim();
  if (body.description !== undefined)
    data.description = body.description?.trim() || null;
  if (body.pickupInfo !== undefined)
    data.pickupInfo = body.pickupInfo?.trim() || null;
  if (body.orderByAt !== undefined)
    data.orderByAt = body.orderByAt ? new Date(body.orderByAt) : null;
  if (body.status === "OPEN" || body.status === "CLOSED")
    data.status = body.status;

  await prisma.foodMenu.update({ where: { id }, data });

  // Per-dish edits (price / soldOut / add). Kept simple: caller sends the
  // dishes it wants to upsert; we don't bulk-delete here to avoid nuking
  // dishes referenced by orders.
  const isMarket = menu.kind === "MARKET";
  // Normalise a unit for a MARKET item; null otherwise. Falls back to a default
  // so an existing market item never loses its unit on a partial edit.
  const cleanUnit = (raw: unknown): string | null => {
    if (!isMarket) return null;
    const u = typeof raw === "string" ? raw.trim() : "";
    return MARKET_UNIT_VALUES.includes(u) ? u : null;
  };

  if (Array.isArray(body.items)) {
    for (let idx = 0; idx < body.items.length; idx++) {
      const it = body.items[idx] as {
        id?: string;
        name?: string;
        description?: string | null;
        price?: number;
        unit?: string | null;
        imageUrl?: string | null;
        soldOut?: boolean;
      };
      const unit = cleanUnit(it.unit);
      if (it.id) {
        await prisma.foodMenuItem.updateMany({
          where: { id: it.id, menuId: id },
          data: {
            ...(it.name?.trim() ? { name: it.name.trim() } : {}),
            ...(it.description !== undefined
              ? { description: it.description?.trim() || null }
              : {}),
            ...(it.price !== undefined ? { price: round2(Number(it.price)) } : {}),
            ...(isMarket && it.unit !== undefined ? { unit } : {}),
            ...(it.imageUrl !== undefined
              ? { imageUrl: it.imageUrl?.trim() || null }
              : {}),
            ...(typeof it.soldOut === "boolean" ? { soldOut: it.soldOut } : {}),
            sortOrder: idx,
          },
        });
      } else if (it.name?.trim()) {
        await prisma.foodMenuItem.create({
          data: {
            menuId: id,
            name: it.name.trim(),
            description: it.description?.trim() || null,
            price: round2(Number(it.price) || 0),
            unit,
            imageUrl: it.imageUrl?.trim() || null,
            sortOrder: idx,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/food/menus/[id]
//   Chef-owner: hard-delete if it has NO non-cancelled orders; otherwise
//   soft-archive (status=ARCHIVED) to preserve paid/owed history.
//   Admin: ?force=1 hard-deletes regardless (moderation).
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";

  const menu = await prisma.foodMenu.findUnique({ where: { id } });
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = isAdmin(me.roles);
  if (menu.chefId !== me.id && !admin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (admin && force) {
    await prisma.foodMenu.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: "hard" });
  }

  const liveOrders = await prisma.foodOrder.count({
    where: { menuId: id, status: { not: "CANCELLED" } },
  });
  if (liveOrders > 0) {
    await prisma.foodMenu.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return NextResponse.json({ ok: true, deleted: "archived" });
  }

  await prisma.foodMenu.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: "hard" });
}
