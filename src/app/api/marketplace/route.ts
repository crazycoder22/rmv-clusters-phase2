import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "recent";
  const status = searchParams.get("status") || "ACTIVE";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (type) where.listingType = type;
  if (search?.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: "insensitive" } },
      { description: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const orderBy =
    sort === "price_asc"
      ? [{ price: "asc" as const }]
      : sort === "price_desc"
      ? [{ price: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  const listings = await prisma.marketplaceListing.findMany({
    where,
    include: {
      seller: { select: { name: true, block: true, flatNumber: true } },
      _count: { select: { wishlistedBy: true } },
      wishlistedBy: {
        where: { residentId: resident.id },
        select: { id: true },
      },
    },
    orderBy,
  });

  return NextResponse.json({ listings });
}

export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const body = await request.json();
  const {
    title,
    description,
    images,
    category,
    listingType,
    price,
    rentPeriod,
    whatsappNumber,
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json(
      { error: "Description is required" },
      { status: 400 }
    );
  }
  if (!category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }
  if (!listingType) {
    return NextResponse.json(
      { error: "Listing type is required" },
      { status: 400 }
    );
  }
  if (!whatsappNumber?.trim()) {
    return NextResponse.json(
      { error: "WhatsApp number is required" },
      { status: 400 }
    );
  }
  if (listingType === "RENT" && !rentPeriod) {
    return NextResponse.json(
      { error: "Rent period is required for rental listings" },
      { status: 400 }
    );
  }

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.marketplaceListing.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        images: images || [],
        category,
        listingType,
        price: listingType === "GIVEAWAY" ? 0 : Number(price) || 0,
        rentPeriod: listingType === "RENT" ? rentPeriod : null,
        whatsappNumber: whatsappNumber.trim(),
        sellerId: resident.id,
      },
    });

    const subscribers = await tx.marketplaceCategorySubscription.findMany({
      where: { category },
      select: { residentId: true },
    });
    const recipientIds = subscribers
      .map((s) => s.residentId)
      .filter((rid) => rid !== resident.id);
    if (recipientIds.length > 0) {
      await tx.notification.createMany({
        data: recipientIds.map((rid) => ({
          residentId: rid,
          marketplaceListingId: created.id,
          message: `New ${listingType.toLowerCase()}: ${created.title}`,
        })),
        skipDuplicates: true,
      });
    }

    return created;
  });

  return NextResponse.json({ listing }, { status: 201 });
}
