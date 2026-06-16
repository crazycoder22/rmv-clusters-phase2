import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../../../generated/prisma/client";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import { isCommentingOpen, validateComment, sanitizeMentionIds, type InitiativeStatusValue, type CommentMention } from "@/lib/initiatives";

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

  // Pull the whole thread (parent + existing replies) so we know who was tagged
  // anywhere in it — those people get notified of the new reply.
  const parent = await prisma.initiativeComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      initiativeId: true,
      parentId: true,
      authorId: true,
      mentions: true,
      replies: { select: { authorId: true, mentions: true } },
    },
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

  // Resolve @mentions in this reply (canonical names from DB).
  const mentionIds = sanitizeMentionIds(body?.mentionedIds);
  const mentioned =
    mentionIds.length > 0
      ? await prisma.resident.findMany({
          where: { id: { in: mentionIds }, isApproved: true },
          select: { id: true, name: true },
        })
      : [];

  const reply = await prisma.initiativeComment.create({
    data: {
      initiativeId: id,
      authorId: me.id,
      parentId: commentId,
      content: v.content,
      mentions: mentioned as unknown as Prisma.InputJsonValue,
      isOfficial: true,
    },
  });

  // ---- Notifications (dedupe with Sets; always exclude the replier) ----
  const mentionIdsOf = (m: unknown) =>
    (Array.isArray(m) ? (m as CommentMention[]) : []).map((x) => x.id);

  // 1. People tagged in THIS reply → "mentioned you".
  const newlyMentioned = new Set(mentioned.map((r) => r.id));
  newlyMentioned.delete(me.id);
  if (newlyMentioned.size > 0) {
    sendPushToResidents([...newlyMentioned], {
      title: "📌 You were mentioned",
      body: `${me.name} mentioned you on “${initiative.title}”`,
      data: { type: "initiative", id },
    }).catch(() => {});
  }

  // 2. Everyone else involved in the thread (parent author + reply authors +
  //    anyone tagged anywhere in the thread) → "new reply".
  const threadParticipants = new Set<string>([
    parent.authorId,
    ...mentionIdsOf(parent.mentions),
    ...parent.replies.flatMap((r) => [r.authorId, ...mentionIdsOf(r.mentions)]),
  ]);
  threadParticipants.delete(me.id);
  for (const rid of newlyMentioned) threadParticipants.delete(rid);
  if (threadParticipants.size > 0) {
    sendPushToResidents([...threadParticipants], {
      title: "💬 New reply",
      body: `${me.name} replied on “${initiative.title}”`,
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
