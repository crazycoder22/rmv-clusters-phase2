import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";

  if (q.length < 1) {
    return NextResponse.json({ residents: [] });
  }

  const blockNum = parseInt(q);
  const blockFilter =
    !isNaN(blockNum) && blockNum >= 1 && blockNum <= 4
      ? [{ block: blockNum }]
      : [];

  const residents = await prisma.resident.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { flatNumber: { contains: q, mode: "insensitive" } },
        ...blockFilter,
      ],
    },
    select: { name: true, block: true, flatNumber: true },
    take: 20,
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  return NextResponse.json({ residents });
}
