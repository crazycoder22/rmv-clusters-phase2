import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { rating, comment } = body;

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be between 1 and 5" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const worker = await prisma.domesticHelp.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  // Upsert review + recalculate denormalized fields in a transaction
  const review = await prisma.$transaction(async (tx) => {
    const upserted = await tx.domesticHelpReview.upsert({
      where: {
        domesticHelpId_residentId: {
          domesticHelpId: id,
          residentId: resident.id,
        },
      },
      create: {
        domesticHelpId: id,
        residentId: resident.id,
        rating: Math.round(rating),
        comment: comment?.trim() || null,
      },
      update: {
        rating: Math.round(rating),
        comment: comment?.trim() || null,
      },
    });

    // Recalculate avg rating and count
    const agg = await tx.domesticHelpReview.aggregate({
      where: { domesticHelpId: id },
      _avg: { rating: true },
      _count: true,
    });

    await tx.domesticHelp.update({
      where: { id },
      data: {
        avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count,
      },
    });

    return upserted;
  });

  return NextResponse.json({ review });
}
