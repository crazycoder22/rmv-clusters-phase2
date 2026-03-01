import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  // Parse type prefix and ID
  const match = code.match(/^(r|g)-(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid pass code" }, { status: 400 });
  }

  const [, type, id] = match;

  try {
    if (type === "r") {
      // Resident RSVP
      const rsvp = await prisma.rsvp.findUnique({
        where: { id },
        include: {
          resident: {
            select: { name: true, block: true, flatNumber: true, email: true },
          },
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
          eventConfig: {
            include: {
              announcement: { select: { id: true, title: true, date: true } },
              menuItems: true,
            },
          },
        },
      });

      if (!rsvp) {
        return NextResponse.json({ error: "Pass not found" }, { status: 404 });
      }

      const hasFood = rsvp.eventConfig.menuItems.length > 0;

      return NextResponse.json({
        type: "resident",
        passCode: code,
        eventTitle: rsvp.eventConfig.announcement.title,
        eventDate: rsvp.eventConfig.announcement.date,
        announcementId: rsvp.eventConfig.announcement.id,
        name: rsvp.resident.name,
        email: rsvp.resident.email,
        block: rsvp.resident.block,
        flatNumber: rsvp.resident.flatNumber,
        hasFood,
        items: rsvp.items.map((i) => ({
          name: i.menuItem.name,
          plates: i.plates,
          pricePerPlate: i.menuItem.pricePerPlate,
        })),
        paid: rsvp.paid,
        notes: rsvp.notes,
        createdAt: rsvp.createdAt,
        fieldResponses: rsvp.fieldResponses.map((fr) => ({
          label: fr.customField.label,
          value: fr.value,
        })),
      });
    } else {
      // Guest RSVP
      const guestRsvp = await prisma.guestRsvp.findUnique({
        where: { id },
        include: {
          items: { include: { menuItem: true } },
          fieldResponses: { include: { customField: true } },
          eventConfig: {
            include: {
              announcement: { select: { id: true, title: true, date: true } },
              menuItems: true,
            },
          },
        },
      });

      if (!guestRsvp) {
        return NextResponse.json({ error: "Pass not found" }, { status: 404 });
      }

      const hasFood = guestRsvp.eventConfig.menuItems.length > 0;

      return NextResponse.json({
        type: "guest",
        passCode: code,
        eventTitle: guestRsvp.eventConfig.announcement.title,
        eventDate: guestRsvp.eventConfig.announcement.date,
        announcementId: guestRsvp.eventConfig.announcement.id,
        name: guestRsvp.name,
        email: guestRsvp.email,
        block: guestRsvp.block,
        flatNumber: guestRsvp.flatNumber,
        hasFood,
        items: guestRsvp.items.map((i) => ({
          name: i.menuItem.name,
          plates: i.plates,
          pricePerPlate: i.menuItem.pricePerPlate,
        })),
        paid: guestRsvp.paid,
        notes: guestRsvp.notes,
        createdAt: guestRsvp.createdAt,
        fieldResponses: guestRsvp.fieldResponses.map((fr) => ({
          label: fr.customField.label,
          value: fr.value,
        })),
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch pass" },
      { status: 500 }
    );
  }
}
