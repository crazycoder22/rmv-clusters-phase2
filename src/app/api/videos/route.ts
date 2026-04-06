import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VideoCategory } from "../../../generated/prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const where = category && Object.values(VideoCategory).includes(category as VideoCategory)
    ? { category: category as VideoCategory }
    : {};

  const videos = await prisma.video.findMany({
    where,
    orderBy: [
      { featured: "desc" },
      { order: "asc" },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json({ videos });
}
