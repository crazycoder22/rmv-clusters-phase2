import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.marketplaceWishlist.deleteMany({
    where: { listingId: id, residentId: resident.id },
  });

  return NextResponse.json({ wishlisted: false });
}
