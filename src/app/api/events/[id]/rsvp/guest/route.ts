import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch event info + menu items (no auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: { menuItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json(
      { error: "Event not found or RSVP not enabled" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
      summary: announcement.summary,
    },
    eventConfig: announcement.eventConfig,
  });
}

// POST: Create guest RSVP (no auth required)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, email, phone, block, flatNumber, items, notes } = body;

  // Validate required fields
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { error: "Name, email, and phone are required" },
      { status: 400 }
    );
  }

  // Validate block
  const blockNum = Number(block);
  if (!blockNum || blockNum < 1 || blockNum > 4) {
    return NextResponse.json(
      { error: "Please select a valid block (1-4)" },
      { status: 400 }
    );
  }

  // Validate flat number
  if (!flatNumber?.trim()) {
    return NextResponse.json(
      { error: "Please select a flat number" },
      { status: 400 }
    );
  }

  const flatExists = await prisma.flat.findUnique({
    where: { block_flatNumber: { block: blockNum, flatNumber: flatNumber.trim() } },
  });
  if (!flatExists) {
    return NextResponse.json(
      { error: "Invalid flat number for the selected block" },
      { status: 400 }
    );
  }

  // Validate items
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "At least one item is required" },
      { status: 400 }
    );
  }

  const totalPlates = items.reduce(
    (sum: number, item: { plates: number }) => sum + (item.plates || 0),
    0
  );
  if (totalPlates === 0) {
    return NextResponse.json(
      { error: "Select at least one plate" },
      { status: 400 }
    );
  }

  // Fetch event config
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { eventConfig: true },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json(
      { error: "Event not found or RSVP not enabled" },
      { status: 404 }
    );
  }

  const eventConfig = announcement.eventConfig;

  // Check deadline
  if (new Date() > new Date(eventConfig.rsvpDeadline)) {
    return NextResponse.json(
      { error: "RSVP deadline has passed" },
      { status: 400 }
    );
  }

  // Check duplicate by email
  const existingRsvp = await prisma.guestRsvp.findUnique({
    where: {
      eventConfigId_email: {
        eventConfigId: eventConfig.id,
        email: email.trim().toLowerCase(),
      },
    },
  });

  if (existingRsvp) {
    return NextResponse.json(
      { error: "An RSVP with this email already exists for this event" },
      { status: 409 }
    );
  }

  // Create guest RSVP
  const guestRsvp = await prisma.guestRsvp.create({
    data: {
      eventConfigId: eventConfig.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      block: blockNum,
      flatNumber: flatNumber.trim(),
      notes: notes?.trim() || null,
      items: {
        create: items
          .filter((item: { plates: number }) => item.plates > 0)
          .map((item: { menuItemId: string; plates: number }) => ({
            menuItemId: item.menuItemId,
            plates: item.plates,
          })),
      },
    },
    include: {
      items: { include: { menuItem: true } },
    },
  });

  return NextResponse.json({ success: true, guestRsvp }, { status: 201 });
}
