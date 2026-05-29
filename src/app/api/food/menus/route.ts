import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import { round2, MAX_OPEN_MENUS, isMenuOrderable } from "@/lib/food";
import { ymdToInstant, isValidYmd } from "@/lib/habits";

export const dynamic = "force-dynamic";

// GET /api/food/menus
//   ?mine=chef → menus I published (any status except ARCHIVED)
//   (default)  → all OPEN menus from everyone (the "order food" browse list)
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mine = searchParams.get("mine") === "chef";

  const where = mine
    ? { chefId: me.id, status: { not: "ARCHIVED" as const } }
    : { status: "OPEN" as const };

  const menus = await prisma.foodMenu.findMany({
    where,
    include: {
      chef: { select: { id: true, name: true, block: true, flatNumber: true } },
      items: { orderBy: { sortOrder: "asc" }, select: { id: true, price: true, soldOut: true } },
      _count: { select: { orders: true } },
      // Whether *I* already ordered from this menu (browse list affordance).
      orders: mine
        ? false
        : { where: { buyerId: me.id }, select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const now = new Date();
  return NextResponse.json({
    menus: menus.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      date: m.date,
      orderByAt: m.orderByAt,
      pickupInfo: m.pickupInfo,
      status: m.status,
      orderable: isMenuOrderable(m.status, m.orderByAt, now),
      itemCount: m.items.length,
      minPrice: m.items.length
        ? Math.min(...m.items.map((i) => i.price))
        : 0,
      orderCount: m._count.orders,
      iOrdered: mine ? undefined : (m.orders?.length ?? 0) > 0,
      chef: {
        id: m.chef.id,
        name: m.chef.name,
        block: m.chef.block,
        flatNumber: m.chef.flatNumber,
        isMe: m.chef.id === me.id,
      },
    })),
  });
}

// POST /api/food/menus — publish a menu with dishes. Any approved resident.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { title, description, date, orderByAt, pickupInfo, items } = body as {
    title?: string;
    description?: string | null;
    date?: string;
    orderByAt?: string | null;
    pickupInfo?: string | null;
    items?: Array<{
      name?: string;
      description?: string | null;
      price?: number;
      imageUrl?: string | null;
    }>;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!isValidYmd(date)) {
    return NextResponse.json(
      { error: "Valid date (YYYY-MM-DD) required" },
      { status: 400 }
    );
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Add at least one dish" },
      { status: 400 }
    );
  }
  const cleanItems = items
    .map((it, idx) => ({
      name: (it.name ?? "").trim(),
      description: it.description?.trim() || null,
      price: round2(Number(it.price)),
      imageUrl: it.imageUrl?.trim() || null,
      sortOrder: idx,
    }))
    .filter((it) => it.name);
  if (cleanItems.length === 0) {
    return NextResponse.json({ error: "Dishes need names" }, { status: 400 });
  }
  if (cleanItems.some((it) => !Number.isFinite(it.price) || it.price < 0)) {
    return NextResponse.json({ error: "Invalid dish price" }, { status: 400 });
  }

  // Active-menu cap.
  const openCount = await prisma.foodMenu.count({
    where: { chefId: me.id, status: "OPEN" },
  });
  if (openCount >= MAX_OPEN_MENUS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_OPEN_MENUS} open menus` },
      { status: 400 }
    );
  }

  const menu = await prisma.foodMenu.create({
    data: {
      chefId: me.id,
      title: title.trim(),
      description: description?.trim() || null,
      date: ymdToInstant(date),
      orderByAt: orderByAt ? new Date(orderByAt) : null,
      pickupInfo: pickupInfo?.trim() || null,
      items: { create: cleanItems },
    },
  });

  // Push on publish. For launch we broadcast to ALL approved residents
  // (minus the chef) so the feature gets discovered; once residents start
  // following their favourite chefs we can narrow this to followers only
  // (the ChefFollow rows + the per-chef query below are already in place).
  // Best-effort — never block menu creation on a push failure.
  try {
    const residents = await prisma.resident.findMany({
      where: { isApproved: true, id: { not: me.id } },
      select: { id: true },
    });
    const ids = residents.map((r) => r.id);
    if (ids.length > 0) {
      await sendPushToResidents(ids, {
        title: `🍲 ${me.name} published a menu`,
        body: menu.title,
        data: { type: "food_menu", id: menu.id },
      });
    }
  } catch (err) {
    console.error("[food menu push] failed:", err);
  }

  return NextResponse.json({ id: menu.id }, { status: 201 });
}
