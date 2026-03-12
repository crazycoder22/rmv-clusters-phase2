import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const newsletters = await prisma.newsletter.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      edition: true,
      publishedAt: true,
      _count: { select: { sections: true } },
    },
  });

  return NextResponse.json({ newsletters });
}
