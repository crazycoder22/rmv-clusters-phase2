import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// POST /api/initiatives/[id]/comments/[commentId]/like → toggle like.
// Allowed even after the comment deadline (likes are a lightweight signal,
// not "feedback"). Any approved resident can like any comment.
export async function POST(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, commentId } = await params;

  const comment = await prisma.initiativeComment.findUnique({
    where: { id: commentId },
    select: { id: true, initiativeId: true },
  });
  if (!comment || comment.initiativeId !== id) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const existing = await prisma.initiativeCommentLike.findUnique({
    where: { commentId_residentId: { commentId, residentId: me.id } },
  });

  let liked: boolean;
  if (existing) {
    await prisma.initiativeCommentLike.delete({ where: { id: existing.id } });
    liked = false;
  } else {
    await prisma.initiativeCommentLike.create({ data: { commentId, residentId: me.id } });
    liked = true;
  }

  const likeCount = await prisma.initiativeCommentLike.count({ where: { commentId } });
  return NextResponse.json({ liked, likeCount });
}
