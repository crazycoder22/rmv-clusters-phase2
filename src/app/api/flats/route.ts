import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const block = searchParams.get("block");

  const where: Record<string, unknown> = {};
  if (block) {
    const blockNum = parseInt(block);
    if (!isNaN(blockNum) && blockNum >= 1 && blockNum <= 4) {
      where.block = blockNum;
    }
  }

  const flats = await prisma.flat.findMany({
    where,
    select: { id: true, block: true, flatNumber: true },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  return NextResponse.json({ flats });
}
