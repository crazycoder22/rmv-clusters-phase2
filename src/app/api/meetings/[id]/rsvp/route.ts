import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMeetings } from "@/lib/roles";

async function requireMeetingsAccess() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageMeetings(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id: meetingId } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["ATTENDING", "DECLINED", "MAYBE"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, status: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (meeting.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot RSVP to a cancelled meeting" }, { status: 400 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: check.session.user.email! },
    select: { id: true },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const rsvp = await prisma.meetingRsvp.upsert({
    where: {
      meetingId_residentId: {
        meetingId,
        residentId: resident.id,
      },
    },
    update: { status },
    create: {
      meetingId,
      residentId: resident.id,
      status,
    },
  });

  return NextResponse.json({ rsvp });
}
