import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMarketplace } from "@/lib/roles";

export async function GET(
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

  const listing = await prisma.marketplaceListing.findUnique({
    where: { id },
    include: {
      seller: {
        select: { id: true, name: true, block: true, flatNumber: true },
      },
      _count: { select: { wishlistedBy: true } },
      wishlistedBy: {
        where: { residentId: resident.id },
        select: { id: true },
      },
    },
  });

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  return NextResponse.json({
    listing,
    isWishlisted: listing.wishlistedBy.length > 0,
    isOwner: listing.seller.id === resident.id,
  });
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

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const listing = await prisma.marketplaceListing.findUnique({
    where: { id },
    select: { sellerId: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const isOwner = listing.sellerId === resident.id;
  const isAdminUser = canManageMarketplace(session.user.roles);
  if (!isOwner && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined)
    data.description = body.description.trim();
  if (body.images !== undefined) data.images = body.images;
  if (body.category !== undefined) data.category = body.category;
  if (body.listingType !== undefined) data.listingType = body.listingType;
  if (body.price !== undefined) data.price = Number(body.price);
  if (body.rentPeriod !== undefined) data.rentPeriod = body.rentPeriod;
  if (body.status !== undefined) data.status = body.status;
  if (body.whatsappNumber !== undefined)
    data.whatsappNumber = body.whatsappNumber.trim();

  const updated = await prisma.marketplaceListing.update({
    where: { id },
    data,
  });

  return NextResponse.json({ listing: updated });
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

  const listing = await prisma.marketplaceListing.findUnique({
    where: { id },
    select: { sellerId: true },
  });
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const isOwner = listing.sellerId === resident.id;
  const isAdminUser = canManageMarketplace(session.user.roles);
  if (!isOwner && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.marketplaceListing.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
