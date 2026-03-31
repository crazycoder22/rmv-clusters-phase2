import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  await prisma.marketplaceWishlist.upsert({
    where: {
      listingId_residentId: { listingId: id, residentId: resident.id },
    },
    create: { listingId: id, residentId: resident.id },
    update: {},
  });

  return NextResponse.json({ wishlisted: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  await prisma.marketplaceWishlist.deleteMany({
    where: { listingId: id, residentId: resident.id },
  });

  return NextResponse.json({ wishlisted: false });
}
