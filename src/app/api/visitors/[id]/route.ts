import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const visitor = await prisma.visitor.findUnique({
    where: { id },
  });
  if (!visitor) {
    return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
  }

  const role = session.user.role;
  const isSecurityOrAdmin =
    role === "ADMIN" || role === "SUPERADMIN" || role === "SECURITY";

  if (!isSecurityOrAdmin) {
    // Check if this resident lives in the target flat
    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { block: true, flatNumber: true },
    });
    if (
      !resident ||
      resident.block !== visitor.visitingBlock ||
      resident.flatNumber !== visitor.visitingFlat
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ visitor });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const visitor = await prisma.visitor.findUnique({ where: { id } });
  if (!visitor) {
    return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
  }

  if (visitor.status !== "PENDING") {
    return NextResponse.json(
      { error: "Visitor has already been processed" },
      { status: 400 }
    );
  }

  // Only residents of the target flat can approve/reject
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { block: true, flatNumber: true },
  });
  if (
    !resident ||
    resident.block !== visitor.visitingBlock ||
    resident.flatNumber !== visitor.visitingFlat
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.visitor.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ visitor: updated });
}
