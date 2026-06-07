import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriptions = await prisma.marketplaceCategorySubscription.findMany({
    where: { residentId: resident.id },
    select: { category: true },
  });

  return NextResponse.json({
    categories: subscriptions.map((s) => s.category),
  });
}

export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const body = await request.json();
  const { categories } = body;

  if (!Array.isArray(categories)) {
    return NextResponse.json(
      { error: "Categories must be an array" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.marketplaceCategorySubscription.deleteMany({
      where: { residentId: resident.id },
    });
    if (categories.length > 0) {
      await tx.marketplaceCategorySubscription.createMany({
        data: categories.map((cat: string) => ({
          residentId: resident.id,
          category: cat,
        })),
      });
    }
  });

  return NextResponse.json({ categories });
}
