import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ads/[id]/click
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const ad = await prisma.ad.update({
      where: { id },
      data: { clicks: { increment: 1 } },
      select: { linkUrl: true },
    });
    return NextResponse.json({ linkUrl: ad.linkUrl });
  } catch {
    return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  }
}
