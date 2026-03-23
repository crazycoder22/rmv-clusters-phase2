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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id: meetingId } = await params;

  const documents = await prisma.meetingDocument.findMany({
    where: { meetingId },
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
  });

  return NextResponse.json({ documents });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id: meetingId } = await params;
  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  // Verify meeting exists
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Verify document exists
  const document = await prisma.documentFile.findUnique({
    where: { id: documentId },
    select: { id: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Upsert the link (idempotent)
  const meetingDocument = await prisma.meetingDocument.upsert({
    where: {
      meetingId_documentId: { meetingId, documentId },
    },
    update: {},
    create: { meetingId, documentId },
  });

  return NextResponse.json({ meetingDocument }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireMeetingsAccess();
  if ("error" in check && check.error) return check.error;

  const { id: meetingId } = await params;
  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  await prisma.meetingDocument.deleteMany({
    where: { meetingId, documentId },
  });

  return NextResponse.json({ success: true });
}
