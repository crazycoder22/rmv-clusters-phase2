import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMeetings } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageMeetings(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const meetingId = searchParams.get("meetingId");

  // Get IDs of documents already linked to this meeting (to exclude them)
  let excludeIds: string[] = [];
  if (meetingId) {
    const linked = await prisma.meetingDocument.findMany({
      where: { meetingId },
      select: { documentId: true },
    });
    excludeIds = linked.map((l) => l.documentId);
  }

  const documents = await prisma.documentFile.findMany({
    where: {
      ...(query
        ? { name: { contains: query, mode: "insensitive" as const } }
        : {}),
      ...(excludeIds.length > 0
        ? { id: { notIn: excludeIds } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      driveUrl: true,
      fileType: true,
      folder: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: 50,
  });

  return NextResponse.json({ documents });
}
