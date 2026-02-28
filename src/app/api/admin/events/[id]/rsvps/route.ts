import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: {
          menuItems: { orderBy: { sortOrder: "asc" } },
          customFields: { orderBy: { sortOrder: "asc" } },
          rsvps: {
            include: {
              resident: {
                select: { id: true, name: true, email: true, block: true, flatNumber: true },
              },
              items: {
                include: { menuItem: true },
              },
              fieldResponses: {
                include: { customField: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          guestRsvps: {
            include: {
              items: {
                include: { menuItem: true },
              },
              fieldResponses: {
                include: { customField: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json(
      { error: "Event not found or RSVP not enabled" },
      { status: 404 }
    );
  }

  const ec = announcement.eventConfig;
  const rsvps = ec.rsvps;
  const guestRsvps = ec.guestRsvps;

  // Compute summary across both resident and guest RSVPs
  let totalPlates = 0;
  let totalAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  const itemTotals: Record<string, { name: string; plates: number; amount: number }> = {};

  for (const rsvp of rsvps) {
    for (const item of rsvp.items) {
      totalPlates += item.plates;
      const lineTotal = item.plates * item.menuItem.pricePerPlate;
      totalAmount += lineTotal;

      if (!itemTotals[item.menuItem.id]) {
        itemTotals[item.menuItem.id] = { name: item.menuItem.name, plates: 0, amount: 0 };
      }
      itemTotals[item.menuItem.id].plates += item.plates;
      itemTotals[item.menuItem.id].amount += lineTotal;
    }
    if (rsvp.paid) paidCount++;
    else unpaidCount++;
  }

  for (const guestRsvp of guestRsvps) {
    for (const item of guestRsvp.items) {
      totalPlates += item.plates;
      const lineTotal = item.plates * item.menuItem.pricePerPlate;
      totalAmount += lineTotal;

      if (!itemTotals[item.menuItem.id]) {
        itemTotals[item.menuItem.id] = { name: item.menuItem.name, plates: 0, amount: 0 };
      }
      itemTotals[item.menuItem.id].plates += item.plates;
      itemTotals[item.menuItem.id].amount += lineTotal;
    }
    if (guestRsvp.paid) paidCount++;
    else unpaidCount++;
  }

  const totalRsvps = rsvps.length + guestRsvps.length;

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
    },
    eventConfig: {
      id: ec.id,
      mealType: ec.mealType,
      rsvpDeadline: ec.rsvpDeadline,
      menuItems: ec.menuItems,
      customFields: ec.customFields,
    },
    rsvps,
    guestRsvps,
    summary: {
      totalRsvps,
      totalPlates,
      totalAmount,
      paidCount,
      unpaidCount,
      itemTotals: Object.values(itemTotals),
    },
  });
}
