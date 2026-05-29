import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPushToResidents } from "@/lib/push";

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

  const { id: postId } = await params;

  const comments = await prisma.postComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
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
    },
  });

  return NextResponse.json({ comments });
}

export async function POST(
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

  const { id: postId } = await params;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body as { content: string };

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const author = await prisma.resident.findUnique({
    where: { id: resident.id },
    select: {
      id: true,
      name: true,
      block: true,
      flatNumber: true,
      googleImage: true,
    },
  });

  const comment = await prisma.postComment.create({
    data: {
      postId,
      authorId: resident.id,
      content: content.trim(),
    },
  });

  if (post.authorId !== resident.id) {
    await prisma.notification.create({
      data: {
        residentId: post.authorId,
        postId,
        message: `${resident.name} commented on your post`,
      },
    });

    // Push the post author (best-effort; never block the comment).
    // A short snippet of the comment gives useful context.
    try {
      const snippet =
        content.trim().length > 80
          ? `${content.trim().slice(0, 77)}…`
          : content.trim();
      await sendPushToResidents([post.authorId], {
        title: "💬 New comment",
        body: `${resident.name}: ${snippet}`,
        data: { type: "post", id: postId },
      });
    } catch (err) {
      console.error("[comment push] failed:", err);
    }
  }

  return NextResponse.json({ ...comment, author }, { status: 201 });
}
