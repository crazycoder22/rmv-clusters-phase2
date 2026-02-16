import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id, published: true },
    include: {
      eventConfig: {
        include: { menuItems: { orderBy: { sortOrder: "asc" } } },
      },
      sportsConfig: {
        include: { sportItems: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!announcement) {
    return NextResponse.json(
      { error: "Announcement not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ announcement });
}
