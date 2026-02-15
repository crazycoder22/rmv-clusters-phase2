import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.user.isRegistered) {
    return { error: NextResponse.json({ error: "Not registered" }, { status: 403 }) };
  }
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (!resident) {
    return { error: NextResponse.json({ error: "Resident not found" }, { status: 404 }) };
  }
  return { session, resident };
}

// GET: Fetch event info + current user's RSVP
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { resident } = check;

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

  // Fetch current user's RSVP if any
  const myRsvp = await prisma.rsvp.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId: resident!.id,
      },
    },
    include: {
      items: {
        include: { menuItem: true },
      },
    },
  });

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
      summary: announcement.summary,
      body: announcement.body,
      author: announcement.author,
    },
    eventConfig: announcement.eventConfig,
    myRsvp,
  });
}

// POST: Create or update RSVP
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { resident } = check;
  const body = await request.json();
  const { items, notes } = body;

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

  // Upsert RSVP: find existing or create new
  const existingRsvp = await prisma.rsvp.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: eventConfig.id,
        residentId: resident!.id,
      },
    },
  });

  if (existingRsvp) {
    // Delete old items and recreate
    await prisma.rsvpItem.deleteMany({ where: { rsvpId: existingRsvp.id } });
    const rsvp = await prisma.rsvp.update({
      where: { id: existingRsvp.id },
      data: {
        notes: notes || null,
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
    return NextResponse.json({ success: true, rsvp });
  } else {
    const rsvp = await prisma.rsvp.create({
      data: {
        eventConfigId: eventConfig.id,
        residentId: resident!.id,
        notes: notes || null,
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
    return NextResponse.json({ success: true, rsvp }, { status: 201 });
  }
}

// DELETE: Cancel RSVP
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { resident } = check;

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

  // Check deadline
  if (new Date() > new Date(announcement.eventConfig.rsvpDeadline)) {
    return NextResponse.json(
      { error: "RSVP deadline has passed" },
      { status: 400 }
    );
  }

  try {
    await prisma.rsvp.delete({
      where: {
        eventConfigId_residentId: {
          eventConfigId: announcement.eventConfig.id,
          residentId: resident!.id,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "No RSVP found to cancel" },
      { status: 404 }
    );
  }
}
