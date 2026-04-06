import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { VideoCategory } from "../../../../../generated/prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.category !== undefined) {
    if (!Object.values(VideoCategory).includes(body.category))
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    data.category = body.category as VideoCategory;
  }

  const playlist = await prisma.videoPlaylist.update({
    where: { id },
    data,
    include: { videos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  return NextResponse.json({ playlist });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { id } = await params;
  await prisma.videoPlaylist.delete({ where: { id } }); // cascades to videos
  return NextResponse.json({ ok: true });
}
