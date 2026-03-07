import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: {
          feedbacks: {
            include: {
              resident: {
                select: { name: true, block: true, flatNumber: true },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!announcement || !announcement.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const feedbacks = announcement.eventConfig.feedbacks;

  // Compute summary
  const totalFeedbacks = feedbacks.length;
  const averageRating =
    totalFeedbacks > 0
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / totalFeedbacks
      : 0;
  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const f of feedbacks) {
    ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
  }

  return NextResponse.json({
    announcement: { id: announcement.id, title: announcement.title, date: announcement.date },
    feedbacks,
    summary: {
      totalFeedbacks,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
    },
  });
}
