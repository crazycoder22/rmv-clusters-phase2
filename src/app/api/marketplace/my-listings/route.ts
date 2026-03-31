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

  const listings = await prisma.marketplaceListing.findMany({
    where: { sellerId: resident.id },
    include: {
      seller: { select: { name: true, block: true, flatNumber: true } },
      _count: { select: { wishlistedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ listings });
}
