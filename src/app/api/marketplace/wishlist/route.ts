import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const wishlisted = await prisma.marketplaceWishlist.findMany({
    where: { residentId: resident.id },
    include: {
      listing: {
        include: {
          seller: { select: { name: true, block: true, flatNumber: true } },
          _count: { select: { wishlistedBy: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const listings = wishlisted.map((w) => ({
    ...w.listing,
    wishlistedBy: [{ id: w.id }], // mark as wishlisted
  }));

  return NextResponse.json({ listings });
}
