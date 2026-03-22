import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const warriors = await prisma.resident.findMany({
    where: { isSosWarrior: true, isApproved: true },
    select: {
      id: true,
      name: true,
      phone: true,
      block: true,
      flatNumber: true,
    },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  return NextResponse.json({ warriors });
}
