import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
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

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: post.id,
    content: post.content,
    images: post.images,
    videoUrl: post.videoUrl,
    author: post.author,
    commentCount: post._count.comments,
    likeCount: post._count.likes,
    isLiked: post.likes.length > 0,
    createdAt: post.createdAt,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { authorId: true, images: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const isAuthor = post.authorId === resident.id;
  const isAdminish = resident.roles.some((r) =>
    ["ADMIN", "SUPERADMIN"].includes(r)
  );

  if (!isAuthor && !isAdminish) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cleanup Vercel Blob images (best-effort)
  if (post.images.length > 0) {
    try {
      await Promise.all(post.images.map((url) => del(url)));
    } catch {
      // ignore
    }
  }

  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
