import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAds } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAds(resident.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { resident };
}

// GET /api/admin/ads
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const ads = await prisma.ad.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ads });
}

// POST /api/admin/ads
export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, description, imageUrl, linkUrl, placement, pages, startDate, endDate } = body;

  if (!title?.trim() || !imageUrl?.trim() || !linkUrl?.trim()) {
    return NextResponse.json({ error: "Title, image, and link are required" }, { status: 400 });
  }
  if (!placement || !["top", "bottom"].includes(placement)) {
    return NextResponse.json({ error: "Placement must be 'top' or 'bottom'" }, { status: 400 });
  }
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "At least one page is required" }, { status: 400 });
  }
  if (!startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: "Valid start and end dates required" }, { status: 400 });
  }

  const ad = await prisma.ad.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      imageUrl: imageUrl.trim(),
      linkUrl: linkUrl.trim(),
      placement,
      pages,
      startDate,
      endDate,
    },
  });

  return NextResponse.json({ ad });
}
