import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email || !session.user.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const { id: postId } = await params;

  // Verify post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Check if already liked
  const existing = await prisma.postLike.findUnique({
    where: { postId_residentId: { postId, residentId: resident.id } },
  });

  if (existing) {
    // Unlike
    await prisma.postLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  // Like
  await prisma.postLike.create({
    data: { postId, residentId: resident.id },
  });

  // Notify post author (don't notify yourself)
  if (post.authorId !== resident.id) {
    await prisma.notification.create({
      data: {
        residentId: post.authorId,
        postId,
        message: `${resident.name} liked your post`,
      },
    });
  }

  return NextResponse.json({ liked: true });
}
