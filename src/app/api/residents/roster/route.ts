import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

// Browse-by-building roster for the Resident Directory. Message-only: returns
// name, flat, residentType (Owner/Tenant) and the Google avatar — never phone
// numbers or vehicles. Approved residents only, on both sides.
//   GET /api/residents/roster            → { blocks: [{ block, count }] }
//   GET /api/residents/roster?block=N    → { residents: [...] }  (no phone)
export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const blockParam = searchParams.get("block");

  if (!blockParam) {
    const grouped = await prisma.resident.groupBy({
      by: ["block"],
      where: { isApproved: true },
      _count: { _all: true },
      orderBy: { block: "asc" },
    });
    return NextResponse.json({
      blocks: grouped.map((g) => ({ block: g.block, count: g._count._all })),
    });
  }

  const block = parseInt(blockParam, 10);
  if (isNaN(block)) {
    return NextResponse.json({ residents: [] });
  }

  const residents = await prisma.resident.findMany({
    where: { isApproved: true, block },
    select: {
      id: true,
      name: true,
      flatNumber: true,
      residentType: true,
      googleImage: true,
    },
    orderBy: [{ flatNumber: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ residents });
}
