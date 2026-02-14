import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const announcements = await prisma.announcement.findMany({
    where: { published: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ announcements });
}
