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

// GET: Fetch current user's feedback for this event
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
    include: { eventConfig: true },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!announcement.eventConfig.enableFeedback) {
    return NextResponse.json({ error: "Feedback not enabled" }, { status: 404 });
  }

  const myFeedback = await prisma.eventFeedback.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId: resident.id,
      },
    },
  });

  return NextResponse.json({ myFeedback });
}

// POST: Submit or update feedback
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { resident } = check;
  const body = await request.json();
  const { rating, comment } = body;

  // Validate rating
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be an integer between 1 and 5" },
      { status: 400 }
    );
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { eventConfig: true },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (!announcement.eventConfig.enableFeedback) {
    return NextResponse.json({ error: "Feedback not enabled" }, { status: 400 });
  }

  // Check event date has passed
  if (new Date() <= new Date(announcement.date)) {
    return NextResponse.json(
      { error: "Feedback can only be submitted after the event" },
      { status: 400 }
    );
  }

  // Verify user has RSVP for this event
  const rsvp = await prisma.rsvp.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId: resident.id,
      },
    },
  });

  if (!rsvp) {
    return NextResponse.json(
      { error: "You must have RSVPed to submit feedback" },
      { status: 403 }
    );
  }

  // Upsert feedback
  const feedback = await prisma.eventFeedback.upsert({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId: resident.id,
      },
    },
    create: {
      eventConfigId: announcement.eventConfig.id,
      residentId: resident.id,
      rating,
      comment: comment || null,
    },
    update: {
      rating,
      comment: comment || null,
    },
  });

  return NextResponse.json({ feedback });
}
