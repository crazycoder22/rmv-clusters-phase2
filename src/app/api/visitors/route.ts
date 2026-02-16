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
  const search = searchParams.get("search")?.trim();

  try {
    const where = search
      ? {
          OR: [
            { phone: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
            { name: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ visitors });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch visitors" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const result = await requireVisitorAccess();
  if ("error" in result && result.error) return result.error;

  try {
    const body = await request.json();
    const { name, phone, email, vehicleNumber, visitingBlock, visitingFlat } =
      body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Visitor name is required" },
        { status: 400 }
      );
    }
    if (!phone?.trim() && !email?.trim()) {
      return NextResponse.json(
        { error: "Phone number or email is required" },
        { status: 400 }
      );
    }
    const block = parseInt(visitingBlock);
    if (!block || block < 1 || block > 4) {
      return NextResponse.json(
        { error: "Valid block number (1-4) is required" },
        { status: 400 }
      );
    }
    if (!visitingFlat?.trim()) {
      return NextResponse.json(
        { error: "Flat number is required" },
        { status: 400 }
      );
    }

    const visitor = await prisma.visitor.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        vehicleNumber: vehicleNumber?.trim() || null,
        visitingBlock: block,
        visitingFlat: visitingFlat.trim(),
      },
    });

    return NextResponse.json({ visitor }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to register visitor" },
      { status: 500 }
    );
  }
}
