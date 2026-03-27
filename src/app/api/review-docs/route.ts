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

export async function GET() {
  const result = await requireResident();
  if ("error" in result && result.error instanceof NextResponse) {
    return result.error;
  }

  const docs = await prisma.reviewDocument.findMany({
    where: {
      status: { in: ["PUBLISHED", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      linkedDocument: {
        select: { id: true, name: true },
      },
      _count: {
        select: { comments: true },
      },
    },
  });

  return NextResponse.json({ docs });
}
