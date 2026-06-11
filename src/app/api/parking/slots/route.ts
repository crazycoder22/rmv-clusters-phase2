import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateRate, validateMonthlyRate, SENTINEL_END } from "@/lib/parking";

const MAX_SLOTS_PER_OWNER = 10;

// GET /api/parking/slots            → browse active slots (others')
// GET /api/parking/slots?mine=owner → slots I own
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "owner";
  const now = new Date();

  const slots = await prisma.parkingSlot.findMany({
    where: mine ? { ownerId: me.id } : { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, block: true, flatNumber: true } },
      bookings: {
        where: { status: "BOOKED", endAt: { gt: now } },
        orderBy: { startAt: "asc" },
        select: { startAt: true, endAt: true },
      },
    },
  });

  const result = slots.map((s) => {
    const current = s.bookings.find(
      (b) => b.startAt.getTime() <= now.getTime() && b.endAt.getTime() > now.getTime()
    );
    // An open-ended monthly booking ends at the far-future sentinel → "ongoing".
    const ongoing = current ? current.endAt.getTime() === SENTINEL_END.getTime() : false;
    return {
      id: s.id,
      label: s.label,
      location: s.location,
      description: s.description,
      hourlyRate: s.hourlyRate,
      monthlyRate: s.monthlyRate,
      active: s.active,
      hasPayInfo: !!(s.payInfo || s.payQrUrl),
      owner: {
        id: s.owner.id,
        name: s.owner.name,
        block: s.owner.block,
        flatNumber: s.owner.flatNumber,
        isMe: s.owner.id === me.id,
      },
      busyNow: !!current,
      busyUntil: current && !ongoing ? current.endAt.toISOString() : null,
      busyOngoing: ongoing,
      upcomingCount: s.bookings.length,
    };
  });

  // On browse, hide my own slots (they appear under "My slots").
  const filtered = mine ? result : result.filter((s) => !s.owner.isMe);
  return NextResponse.json({ slots: filtered });
}

// POST /api/parking/slots → register a slot
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "Give the slot a name/number" }, { status: 400 });

  const rateCheck = validateRate(body.hourlyRate);
  if (!rateCheck.ok) return NextResponse.json({ error: rateCheck.error }, { status: 400 });

  // Monthly rate is an optional add-on.
  let monthlyRate: number | null = null;
  if (body.monthlyRate != null && String(body.monthlyRate).trim() !== "") {
    const mc = validateMonthlyRate(body.monthlyRate);
    if (!mc.ok) return NextResponse.json({ error: mc.error }, { status: 400 });
    monthlyRate = mc.rate!;
  }

  const count = await prisma.parkingSlot.count({ where: { ownerId: me.id } });
  if (count >= MAX_SLOTS_PER_OWNER) {
    return NextResponse.json(
      { error: `You can list up to ${MAX_SLOTS_PER_OWNER} slots` },
      { status: 400 }
    );
  }

  const slot = await prisma.parkingSlot.create({
    data: {
      ownerId: me.id,
      label,
      location: typeof body.location === "string" ? body.location.trim() || null : null,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      hourlyRate: rateCheck.rate!,
      monthlyRate,
      payInfo: typeof body.payInfo === "string" ? body.payInfo.trim() || null : null,
      payQrUrl: typeof body.payQrUrl === "string" ? body.payQrUrl.trim() || null : null,
      active: body.active === false ? false : true,
    },
  });

  return NextResponse.json({ id: slot.id }, { status: 201 });
}
