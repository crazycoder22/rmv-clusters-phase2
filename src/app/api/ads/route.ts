import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getTodayIST(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// GET /api/ads?page=news&placement=top
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page");
  const placement = searchParams.get("placement");

  if (!page) {
    return NextResponse.json({ error: "page param required" }, { status: 400 });
  }

  const today = getTodayIST();

  const ads = await prisma.ad.findMany({
    where: {
      active: true,
      startDate: { lte: today },
      endDate: { gte: today },
      pages: { has: page },
      ...(placement ? { placement } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      linkUrl: true,
      placement: true,
    },
  });

  // Fire-and-forget impression increments
  for (const ad of ads) {
    prisma.ad.update({
      where: { id: ad.id },
      data: { impressions: { increment: 1 } },
    }).catch(() => {});
  }

  return NextResponse.json({ ads });
}
