import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAds } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAds(resident.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { resident };
}

// PATCH /api/admin/ads/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl.trim();
  if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl.trim();
  if (body.placement !== undefined) data.placement = body.placement;
  if (body.pages !== undefined) data.pages = body.pages;
  if (body.startDate !== undefined) data.startDate = body.startDate;
  if (body.endDate !== undefined) data.endDate = body.endDate;
  if (body.active !== undefined) data.active = body.active;

  const ad = await prisma.ad.update({ where: { id }, data });
  return NextResponse.json({ ad });
}

// DELETE /api/admin/ads/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  await prisma.ad.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
