import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireVisitorAccess() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "SECURITY") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: Request) {
  const result = await requireVisitorAccess();
  if ("error" in result && result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 3) {
    return NextResponse.json({ visitors: [] });
  }

  try {
    const visitors = await prisma.visitor.findMany({
      where: {
        OR: [
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      distinct: ["phone", "email"],
    });
    return NextResponse.json({ visitors });
  } catch {
    return NextResponse.json(
      { error: "Failed to search visitors" },
      { status: 500 }
    );
  }
}
