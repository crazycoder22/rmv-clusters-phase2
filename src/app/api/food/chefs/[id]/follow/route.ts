import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST /api/food/chefs/[id]/follow — follow a chef to get menu-publish pushes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: chefId } = await params;
  if (chefId === me.id) {
    return NextResponse.json(
      { error: "You can't follow yourself" },
      { status: 400 }
    );
  }
  const chef = await prisma.resident.findUnique({
    where: { id: chefId },
    select: { id: true },
  });
  if (!chef) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.chefFollow.upsert({
    where: { chefId_followerId: { chefId, followerId: me.id } },
    create: { chefId, followerId: me.id },
    update: {},
  });

  return NextResponse.json({ ok: true, following: true });
}

// DELETE /api/food/chefs/[id]/follow — unfollow.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: chefId } = await params;
  await prisma.chefFollow.deleteMany({
    where: { chefId, followerId: me.id },
  });

  return NextResponse.json({ ok: true, following: false });
}
