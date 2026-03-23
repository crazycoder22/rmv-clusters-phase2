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

export async function GET(request: Request) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where = status ? { status } : {};

  const meetings = await prisma.meeting.findMany({
    where,
    include: {
      creator: { select: { name: true, email: true } },
      _count: { select: { rsvps: true, documents: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ meetings });
}

export async function POST(request: Request) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, agenda, date, location, isPublic } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!agenda?.trim()) {
    return NextResponse.json({ error: "Agenda is required" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  if (!location?.trim()) {
    return NextResponse.json({ error: "Location is required" }, { status: 400 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: check.session.user.email! },
    select: { id: true },
  });

  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: title.trim(),
      agenda: agenda.trim(),
      date: new Date(date),
      location: location.trim(),
      isPublic: isPublic ?? false,
      creatorId: resident.id,
    },
  });

  return NextResponse.json({ meeting }, { status: 201 });
}
