import { NextRequest, NextResponse } from "next/server";
import { canManageAnnouncements } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { extractYouTubeId } from "@/lib/youtube";
import { getAuthedResident } from "@/lib/api-auth";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(resident.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { resident };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(req);
  if ("error" in check) return check.error;

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.playlistId !== undefined) data.playlistId = body.playlistId;
  if (body.youtubeUrl !== undefined) {
    if (!extractYouTubeId(body.youtubeUrl))
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    data.youtubeUrl = body.youtubeUrl.trim();
  }

  const video = await prisma.video.update({ where: { id }, data });
  return NextResponse.json({ video });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin(req);
  if ("error" in check) return check.error;

  const { id } = await params;
  await prisma.video.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
