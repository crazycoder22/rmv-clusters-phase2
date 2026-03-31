import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "recent";

  const where: Record<string, unknown> = {};
  if (category) {
    where.categories = { has: category };
  }
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { description: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const orderBy =
    sort === "rating"
      ? [{ avgRating: "desc" as const }, { reviewCount: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const workers = await prisma.domesticHelp.findMany({
    where,
    include: {
      addedBy: { select: { name: true, block: true, flatNumber: true } },
    },
    orderBy,
  });

  return NextResponse.json({ workers });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const body = await request.json();
  const { name, phone, categories, description, availability } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!phone?.trim()) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }
  if (!categories || !Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json(
      { error: "At least one category is required" },
      { status: 400 }
    );
  }

  const worker = await prisma.domesticHelp.create({
    data: {
      name: name.trim(),
      phone: phone.trim(),
      categories,
      description: description?.trim() || null,
      availability: availability?.trim() || null,
      addedById: resident.id,
    },
  });

  return NextResponse.json({ worker }, { status: 201 });
}
