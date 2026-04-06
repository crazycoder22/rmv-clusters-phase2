import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const playlists = await prisma.videoPlaylist.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      videos: {
        orderBy: [{ featured: "desc" }, { order: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return NextResponse.json({ playlists });
}
