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
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
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

  const worker = await prisma.domesticHelp.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

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
