import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.user.isRegistered) {
    return { error: NextResponse.json({ error: "Not registered" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: Request) {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

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
