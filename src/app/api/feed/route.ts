import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
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
        select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
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
  const session = await auth();
  if (!session?.user?.email || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, block: true, flatNumber: true, googleImage: true },
  });
  if (!resident) {
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
    return NextResponse.json({ error: "Maximum 4 images allowed" }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: {
      content: content.trim(),
      images: images || [],
      videoUrl: videoUrl?.trim() || null,
      authorId: resident.id,
    },
  });

  return NextResponse.json({
    id: post.id,
    content: post.content,
    images: post.images,
    videoUrl: post.videoUrl,
    author: resident,
    commentCount: 0,
    likeCount: 0,
    isLiked: false,
    createdAt: post.createdAt,
  }, { status: 201 });
}
