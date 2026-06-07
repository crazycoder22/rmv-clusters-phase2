import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
