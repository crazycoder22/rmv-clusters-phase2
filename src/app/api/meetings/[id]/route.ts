import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMeetings, isSuperAdmin } from "@/lib/roles";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true, email: true } },
      rsvps: {
        include: {
          resident: {
            select: { id: true, name: true, email: true, block: true, flatNumber: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              name: true,
              driveUrl: true,
              fileUrl: true,
              fileType: true,
              folder: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();

  const { title, agenda, date, location, isPublic, status, momUrl, momSummary } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (agenda !== undefined) data.agenda = agenda.trim();
  if (date !== undefined) data.date = new Date(date);
  if (location !== undefined) data.location = location.trim();
  if (isPublic !== undefined) data.isPublic = isPublic;
  if (status !== undefined) data.status = status;
  if (momUrl !== undefined) data.momUrl = momUrl?.trim() || null;
  if (momSummary !== undefined) data.momSummary = momSummary?.trim() || null;

  const meeting = await prisma.meeting.update({
    where: { id },
    data,
  });

  return NextResponse.json({ meeting });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { email: check.session.user.email! },
    select: { id: true },
  });

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { creatorId: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (meeting.creatorId !== resident?.id && !isSuperAdmin(check.session.user.roles)) {
    return NextResponse.json({ error: "Only the creator or a superadmin can delete" }, { status: 403 });
  }

  await prisma.meeting.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
