import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageDomesticHelp } from "@/lib/roles";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, reviewId } = await params;

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const review = await prisma.domesticHelpReview.findUnique({
    where: { id: reviewId },
    select: { residentId: true, domesticHelpId: true },
  });
  if (!review || review.domesticHelpId !== id) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // Only the review author or admin can delete
  const isAuthor = review.residentId === resident.id;
  const isAdminUser = canManageDomesticHelp(session.user.roles);
  if (!isAuthor && !isAdminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.domesticHelpReview.delete({ where: { id: reviewId } });

    // Recalculate
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
