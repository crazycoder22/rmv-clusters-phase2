import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { istTodayYmd } from "@/lib/dates-ist";

// Resolve the item + assert the caller is an assigned owner of its checklist.
async function loadOwnedItem(itemId: string, residentId: string) {
  const item = await prisma.dutyChecklistItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      active: true,
      checklist: {
        select: {
          active: true,
          owners: { where: { residentId }, select: { id: true } },
        },
      },
    },
  });
  if (!item) return { error: "not_found" as const };
  if (item.checklist.owners.length === 0) return { error: "forbidden" as const };
  return { item };
}

// POST /api/duties/items/[itemId]/check — owner ticks the item for today.
// Idempotent: unique [itemId, date] means a repeat just resolves to "done".
export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { itemId } = await params;
  const res = await loadOwnedItem(itemId, me.id);
  if (res.error === "not_found") return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (res.error === "forbidden") return NextResponse.json({ error: "You're not assigned to this duty" }, { status: 403 });

  const today = istTodayYmd();
  try {
    await prisma.dutyCompletion.create({
      data: { itemId, date: today, residentId: me.id },
    });
  } catch (err: unknown) {
    // P2002 = already completed today by someone (the flat/day is the gate).
    if ((err as { code?: string })?.code !== "P2002") {
      console.error("duty check error", err);
      return NextResponse.json({ error: "Could not save" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, doneToday: true });
}

// DELETE /api/duties/items/[itemId]/check — owner un-ticks today's completion.
export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { itemId } = await params;
  const res = await loadOwnedItem(itemId, me.id);
  if (res.error === "not_found") return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (res.error === "forbidden") return NextResponse.json({ error: "You're not assigned to this duty" }, { status: 403 });

  await prisma.dutyCompletion.deleteMany({ where: { itemId, date: istTodayYmd() } });
  return NextResponse.json({ ok: true, doneToday: false });
}
