import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageDomesticHelp } from "@/lib/roles";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, reviewId } = await params;

  const review = await prisma.domesticHelpReview.findUnique({
    where: { id: reviewId },
    select: { residentId: true, domesticHelpId: true },
  });
  if (!review || review.domesticHelpId !== id) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const isAuthor = review.residentId === resident.id;
  const isAdminUser = canManageDomesticHelp(resident.roles);
  if (!isAuthor && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.domesticHelpReview.delete({ where: { id: reviewId } });

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
  });

  return NextResponse.json({ success: true });
}
