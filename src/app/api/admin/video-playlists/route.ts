import { NextResponse } from "next/server";
import { canManageAnnouncements } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { VideoCategory } from "../../../../generated/prisma/client";
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

export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check) return check.error;

  const playlists = await prisma.videoPlaylist.findMany({
    orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    include: { videos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });

  return NextResponse.json({ playlists });
}

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check) return check.error;

  const { name, description, category, order } = await request.json();

  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!category || !Object.values(VideoCategory).includes(category))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const playlist = await prisma.videoPlaylist.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      category: category as VideoCategory,
      order: typeof order === "number" ? order : 0,
    },
    include: { videos: true },
  });

  return NextResponse.json({ playlist }, { status: 201 });
}
