import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, resident };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireResident();
  if ("error" in result && result.error instanceof NextResponse) {
    return result.error;
  }

  const { id } = await params;

  const doc = await prisma.reviewDocument.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      linkedDocument: {
        select: { id: true, name: true, driveUrl: true },
      },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
        include: {
          resident: {
            select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
          },
          resolvedBy: {
            select: { id: true, name: true },
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              resident: {
                select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
              },
              resolvedBy: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!doc || (doc.status !== "PUBLISHED" && doc.status !== "CLOSED")) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ doc });
}
