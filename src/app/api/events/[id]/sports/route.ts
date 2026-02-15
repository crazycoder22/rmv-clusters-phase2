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

// GET: Fetch sports event info + current user's registration
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
      sportsConfig: {
        include: { sportItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!announcement || !announcement.sportsConfig) {
    return NextResponse.json(
      { error: "Event not found or sports registration not enabled" },
      { status: 404 }
    );
  }

  // Fetch current user's registration if any
  const myRegistration = await prisma.sportsRegistration.findUnique({
    where: {
      sportsConfigId_residentId: {
        sportsConfigId: announcement.sportsConfig.id,
        residentId: resident!.id,
      },
    },
    include: {
      participants: {
        include: {
          sports: {
            include: { sportItem: true },
          },
        },
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
    sportsConfig: announcement.sportsConfig,
    myRegistration,
  });
}

// POST: Create or update sports registration
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { resident } = check;
  const body = await request.json();
  const { participants, notes } = body;

  // Validate participants
  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return NextResponse.json(
      { error: "At least one participant is required" },
      { status: 400 }
    );
  }

  for (const p of participants) {
    if (!p.name || !p.name.trim()) {
      return NextResponse.json(
        { error: "Each participant must have a name" },
        { status: 400 }
      );
    }
    if (!["kid", "teen", "adult"].includes(p.ageCategory)) {
      return NextResponse.json(
        { error: "Age category must be kid, teen, or adult" },
        { status: 400 }
      );
    }
    if (!p.sportItemIds || !Array.isArray(p.sportItemIds) || p.sportItemIds.length === 0) {
      return NextResponse.json(
        { error: `Participant "${p.name}" must select at least one sport` },
        { status: 400 }
      );
    }
  }

  // Fetch sports config
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { sportsConfig: true },
  });

  if (!announcement || !announcement.sportsConfig) {
    return NextResponse.json(
      { error: "Event not found or sports registration not enabled" },
      { status: 404 }
    );
  }

  const sportsConfig = announcement.sportsConfig;

  // Check deadline
  if (new Date() > new Date(sportsConfig.registrationDeadline)) {
    return NextResponse.json(
      { error: "Registration deadline has passed" },
      { status: 400 }
    );
  }

  // Delete existing registration if any (upsert approach: delete + recreate)
  const existing = await prisma.sportsRegistration.findUnique({
    where: {
      sportsConfigId_residentId: {
        sportsConfigId: sportsConfig.id,
        residentId: resident!.id,
      },
    },
  });

  if (existing) {
    await prisma.sportsRegistration.delete({ where: { id: existing.id } });
  }

  // Create new registration with participants
  const registration = await prisma.sportsRegistration.create({
    data: {
      sportsConfigId: sportsConfig.id,
      residentId: resident!.id,
      notes: notes || null,
      participants: {
        create: participants.map(
          (p: { name: string; ageCategory: string; sportItemIds: string[] }) => ({
            name: p.name.trim(),
            ageCategory: p.ageCategory,
            sports: {
              create: p.sportItemIds.map((sportItemId: string) => ({
                sportItemId,
              })),
            },
          })
        ),
      },
    },
    include: {
      participants: {
        include: {
          sports: { include: { sportItem: true } },
        },
      },
    },
  });

  return NextResponse.json(
    { success: true, registration },
    { status: existing ? 200 : 201 }
  );
}

// DELETE: Cancel registration
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
    include: { sportsConfig: true },
  });

  if (!announcement || !announcement.sportsConfig) {
    return NextResponse.json(
      { error: "Event not found or sports registration not enabled" },
      { status: 404 }
    );
  }

  // Check deadline
  if (new Date() > new Date(announcement.sportsConfig.registrationDeadline)) {
    return NextResponse.json(
      { error: "Registration deadline has passed" },
      { status: 400 }
    );
  }

  try {
    await prisma.sportsRegistration.delete({
      where: {
        sportsConfigId_residentId: {
          sportsConfigId: announcement.sportsConfig.id,
          residentId: resident!.id,
        },
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "No registration found to cancel" },
      { status: 404 }
    );
  }
}
