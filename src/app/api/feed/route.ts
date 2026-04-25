import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10") || 10, 20);

  const posts = await prisma.post.findMany({
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          block: true,
          flatNumber: true,
          googleImage: true,
        },
      },
      _count: { select: { comments: true, likes: true } },
      likes: {
        where: { residentId: resident.id },
        select: { id: true },
      },
    },
  });

  let nextCursor: string | null = null;
  if (posts.length > limit) {
    posts.pop();
    nextCursor = posts[posts.length - 1].id;
  }

  const formatted = posts.map((p) => ({
    id: p.id,
    content: p.content,
    images: p.images,
    videoUrl: p.videoUrl,
    author: p.author,
    commentCount: p._count.comments,
    likeCount: p._count.likes,
    isLiked: p.likes.length > 0,
    createdAt: p.createdAt,
  }));

  return NextResponse.json({ posts: formatted, nextCursor });
}

export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  // Re-fetch the bits we need for the response (the helper already gave us
  // name/block/flat but we also want googleImage to render the avatar).
  const fullResident = await prisma.resident.findUnique({
    where: { id: resident.id },
    select: {
      id: true,
      name: true,
      block: true,
      flatNumber: true,
      googleImage: true,
    },
  });
  if (!fullResident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const body = await request.json();
  const { content, images, videoUrl } = body as {
    content: string;
    images?: string[];
    videoUrl?: string;
  };

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  if (images && images.length > 4) {
    return NextResponse.json(
      { error: "Maximum 4 images allowed" },
      { status: 400 }
    );
  }

  const post = await prisma.post.create({
    data: {
      content: content.trim(),
      images: images || [],
      videoUrl: videoUrl?.trim() || null,
      authorId: resident.id,
    },
  });

  return NextResponse.json(
    {
      id: post.id,
      content: post.content,
      images: post.images,
      videoUrl: post.videoUrl,
      author: fullResident,
      commentCount: 0,
      likeCount: 0,
      isLiked: false,
      createdAt: post.createdAt,
    },
    { status: 201 }
  );
}
