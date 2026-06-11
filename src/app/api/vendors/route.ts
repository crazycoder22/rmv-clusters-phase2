import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { MARKET_UNIT_VALUES } from "@/lib/market";

export const dynamic = "force-dynamic";

export const MAX_VENDOR_ITEMS = 60;

// Clean + validate an incoming item list. Returns rows (with sortOrder) or an
// error string. Shared by POST (create) and PATCH (full replace).
export function cleanVendorItems(
  raw: unknown
): { items: { name: string; price: number; unit: string | null; section: string | null; note: string | null; sortOrder: number }[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "Items must be a list" };
  const items = raw
    .map((it, idx) => {
      const r = it as { name?: unknown; price?: unknown; unit?: unknown; section?: unknown; note?: unknown };
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const unitRaw = typeof r.unit === "string" ? r.unit.trim() : "";
      return {
        name,
        price: Math.round((Number(r.price) || 0) * 100) / 100,
        unit: MARKET_UNIT_VALUES.includes(unitRaw) ? unitRaw : null,
        section: typeof r.section === "string" && r.section.trim() ? r.section.trim().slice(0, 30) : null,
        note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 120) : null,
        sortOrder: idx,
      };
    })
    .filter((it) => it.name);
  if (items.length === 0) return { error: "Add at least one item with a name" };
  if (items.length > MAX_VENDOR_ITEMS) return { error: `Up to ${MAX_VENDOR_ITEMS} items` };
  if (items.some((it) => !Number.isFinite(it.price) || it.price < 0)) {
    return { error: "Each item needs a valid price" };
  }
  return { items };
}

// GET /api/vendors  — browse list. ?q= name search, ?mine=1 only mine.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const mine = searchParams.get("mine") === "1";

  const where: Record<string, unknown> = mine ? { addedById: me.id } : { active: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.foodVendor.findMany({
    where,
    include: {
      addedBy: { select: { id: true, name: true, block: true, flatNumber: true } },
      items: { select: { price: true, section: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({
    vendors: vendors.map((v) => {
      const sections = [...new Set(v.items.map((i) => i.section).filter(Boolean) as string[])];
      const minPrice = v.items.length ? Math.min(...v.items.map((i) => i.price)) : 0;
      return {
        id: v.id,
        name: v.name,
        phone: v.phone,
        description: v.description,
        deliveryInfo: v.deliveryInfo,
        photoUrl: v.photoUrl,
        forDate: v.forDate,
        active: v.active,
        itemCount: v.items.length,
        minPrice,
        sections,
        addedBy: {
          name: v.addedBy.name,
          block: v.addedBy.block,
          flatNumber: v.addedBy.flatNumber,
          isMe: v.addedBy.id === me.id,
        },
      };
    }),
  });
}

// POST /api/vendors  — any approved resident adds a vendor.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!me.isApproved) return NextResponse.json({ error: "Not approved" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!name) return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Phone number is required" }, { status: 400 });

  const cleaned = cleanVendorItems(body.items);
  if ("error" in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const vendor = await prisma.foodVendor.create({
    data: {
      name,
      phone,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      deliveryInfo: typeof body.deliveryInfo === "string" ? body.deliveryInfo.trim() || null : null,
      photoUrl: typeof body.photoUrl === "string" ? body.photoUrl.trim() || null : null,
      forDate: body.forDate ? new Date(body.forDate) : null,
      addedById: me.id,
      items: { create: cleaned.items },
    },
  });

  return NextResponse.json({ id: vendor.id }, { status: 201 });
}
