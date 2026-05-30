import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import { isCommentingOpen, validateComment, type InitiativeStatusValue } from "@/lib/initiatives";

// POST /api/initiatives/[id]/comments/[commentId] → committee reply to a feedback
export async function POST(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Only committee members can reply" }, { status: 403 });
  }
  const { id, commentId } = await params;

  const initiative = await prisma.initiative.findUnique({
    where: { id },
    select: { id: true, status: true, commentsCloseAt: true, title: true },
  });
  if (!initiative) return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
  if (!isCommentingOpen(initiative.status as InitiativeStatusValue, initiative.commentsCloseAt)) {
    return NextResponse.json({ error: "Commenting is closed for this initiative" }, { status: 400 });
  }

  const parent = await prisma.initiativeComment.findUnique({
    where: { id: commentId },
    select: { id: true, initiativeId: true, parentId: true, authorId: true },
  });
  if (!parent || parent.initiativeId !== id) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  // One-level threading only: cannot reply to a reply.
  if (parent.parentId !== null) {
    return NextResponse.json({ error: "You can't reply to a reply" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const v = validateComment(body?.content);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const reply = await prisma.initiativeComment.create({
    data: {
      initiativeId: id,
      authorId: me.id,
      parentId: commentId,
      content: v.content,
      isOfficial: true,
    },
  });

  // Notify the feedback author the committee replied (unless replying to self).
  if (parent.authorId !== me.id) {
    sendPushToResidents([parent.authorId], {
      title: "🛡 Committee replied",
      body: `On “${initiative.title}”: ${v.content.slice(0, 80)}`,
      data: { type: "initiative", id },
    }).catch(() => {});
  }

  return NextResponse.json({ id: reply.id }, { status: 201 });
}

// DELETE /api/initiatives/[id]/comments/[commentId]
// Author can delete own (while open); committee can delete any anytime.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, commentId } = await params;

  const comment = await prisma.initiativeComment.findUnique({
    where: { id: commentId },
    select: { id: true, initiativeId: true, authorId: true, initiative: { select: { status: true, commentsCloseAt: true } } },
  });
  if (!comment || comment.initiativeId !== id) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isCommittee = canManageAnnouncements(me.roles);
  const isOwn = comment.authorId === me.id;
  if (!isCommittee && !isOwn) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // A resident may only delete their own comment while commenting is open.
  if (isOwn && !isCommittee) {
    const open = isCommentingOpen(
      comment.initiative.status as InitiativeStatusValue,
      comment.initiative.commentsCloseAt
    );
    if (!open) {
      return NextResponse.json({ error: "Commenting is closed — you can no longer delete this" }, { status: 400 });
    }
  }

  // Cascade removes nested replies + likes (onDelete: Cascade).
  await prisma.initiativeComment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
