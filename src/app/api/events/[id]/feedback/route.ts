import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: Fetch existing feedback for this device
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId");

  if (!deviceId) {
    return NextResponse.json({ error: "Device ID required" }, { status: 400 });
  }

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
      eventConfigId_deviceId: {
        eventConfigId: announcement.eventConfig.id,
        deviceId,
      },
    },
  });

  return NextResponse.json({ myFeedback });
}

// POST: Submit or update feedback (open to anyone with a deviceId)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { rating, comment, deviceId } = body;

  // Validate deviceId
  if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
    return NextResponse.json(
      { error: "Valid device ID is required" },
      { status: 400 }
    );
  }

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

  // Optionally link to resident if user is logged in
  let residentId: string | null = null;
  try {
    const session = await auth();
    if (session?.user?.email && session.user.isRegistered) {
      const resident = await prisma.resident.findUnique({
        where: { email: session.user.email },
      });
      if (resident) {
        residentId = resident.id;
      }
    }
  } catch {
    // Auth check is optional — non-critical
  }

  // Upsert feedback using deviceId for uniqueness
  const feedback = await prisma.eventFeedback.upsert({
    where: {
      eventConfigId_deviceId: {
        eventConfigId: announcement.eventConfig.id,
        deviceId,
      },
    },
    create: {
      eventConfigId: announcement.eventConfig.id,
      deviceId,
      residentId,
      rating,
      comment: comment || null,
    },
    update: {
      rating,
      comment: comment || null,
      // Update residentId if now logged in
      ...(residentId && { residentId }),
    },
  });

  return NextResponse.json({ feedback });
}
