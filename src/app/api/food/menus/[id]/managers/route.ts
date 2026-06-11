import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";
import { MAX_COMANAGERS, isMenuManager } from "@/lib/food";
import { KIND_LABELS, asKind } from "@/lib/market";

export const dynamic = "force-dynamic";

// Co-managers of a Food/Bazaar listing. The owner (chefId) nominates other
// residents who can then edit items + manage orders (but not delete the
// listing or change its co-managers — those stay owner-only).
//
//   GET    → list co-managers (owner or a co-manager may read)
//   POST   { residentId }   add a co-manager (owner only)
//   DELETE ?residentId=...  remove a co-manager (owner only)

async function loadMenu(id: string) {
  return prisma.foodMenu.findUnique({
    where: { id },
    select: { id: true, chefId: true, title: true, kind: true, chef: { select: { name: true } } },
  });
}

function managerType(kind: "KITCHEN" | "MARKET") {
  return kind === "MARKET" ? "market_menu" : "food_menu";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const menu = await loadMenu(id);
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canManage = menu.chefId === me.id || (await isMenuManager(prisma, id, me.id));
  if (!canManage) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.foodMenuManager.findMany({
    where: { menuId: id },
    include: { resident: { select: { id: true, name: true, block: true, flatNumber: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    managers: rows.map((m) => ({
      id: m.resident.id,
      name: m.resident.name,
      block: m.resident.block,
      flatNumber: m.resident.flatNumber,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const menu = await loadMenu(id);
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only the owner manages co-managers.
  if (menu.chefId !== me.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const residentId = typeof body?.residentId === "string" ? body.residentId : "";
  if (!residentId) return NextResponse.json({ error: "Pick a resident" }, { status: 400 });
  if (residentId === me.id) {
    return NextResponse.json({ error: "You already own this listing" }, { status: 400 });
  }

  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { id: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  // Already a co-manager? Idempotent success.
  if (await isMenuManager(prisma, id, residentId)) {
    return NextResponse.json({ ok: true, already: true });
  }

  const count = await prisma.foodMenuManager.count({ where: { menuId: id } });
  if (count >= MAX_COMANAGERS) {
    return NextResponse.json(
      { error: `You can add up to ${MAX_COMANAGERS} co-managers` },
      { status: 409 }
    );
  }

  await prisma.foodMenuManager.create({
    data: { menuId: id, residentId, addedById: me.id },
  });

  // Notify the nominee.
  try {
    const labels = KIND_LABELS[asKind(menu.kind)];
    await sendPushToResidents([residentId], {
      title: `🧑‍🍳 You're a co-manager`,
      body: `${menu.chef.name} added you to help run the ${labels.stall} "${menu.title}"`,
      data: { type: managerType(menu.kind), id },
    });
  } catch (err) {
    console.error("[food co-manager push] failed:", err);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const menu = await loadMenu(id);
  if (!menu) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (menu.chefId !== me.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const residentId = searchParams.get("residentId") ?? "";
  if (!residentId) return NextResponse.json({ error: "Missing residentId" }, { status: 400 });

  await prisma.foodMenuManager.deleteMany({ where: { menuId: id, residentId } });
  return NextResponse.json({ ok: true });
}
