import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check) return check.error;

  const { title, youtubeUrl, playlistId, description, featured, order } = await request.json();

  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!youtubeUrl?.trim() || !extractYouTubeId(youtubeUrl))
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  if (!playlistId)
    return NextResponse.json({ error: "Playlist is required" }, { status: 400 });

  const video = await prisma.video.create({
    data: {
      title: title.trim(),
      youtubeUrl: youtubeUrl.trim(),
      playlistId,
      description: description?.trim() || null,
      featured: Boolean(featured),
      order: typeof order === "number" ? order : 0,
    },
  });

  return NextResponse.json({ video }, { status: 201 });
}
