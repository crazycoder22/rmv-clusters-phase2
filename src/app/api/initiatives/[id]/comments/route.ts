import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../../../generated/prisma/client";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import { isCommentingOpen, validateComment, sanitizeMentionIds, type InitiativeStatusValue } from "@/lib/initiatives";

// POST /api/initiatives/[id]/comments → post top-level feedback (any approved resident)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const initiative = await prisma.initiative.findUnique({
    where: { id },
    select: { id: true, authorId: true, title: true, status: true, commentsCloseAt: true },
  });
  if (!initiative) return NextResponse.json({ error: "Initiative not found" }, { status: 404 });

  if (!isCommentingOpen(initiative.status as InitiativeStatusValue, initiative.commentsCloseAt)) {
    return NextResponse.json({ error: "Commenting is closed for this initiative" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const v = validateComment(body?.content);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // Resolve @mentions: trust IDs from the client, look up canonical names from
  // the DB (drops non-residents / unapproved), and never persist client names.
  const mentionIds = sanitizeMentionIds(body?.mentionedIds);
  const mentioned =
    mentionIds.length > 0
      ? await prisma.resident.findMany({
          where: { id: { in: mentionIds }, isApproved: true },
          select: { id: true, name: true },
        })
      : [];

  const isCommittee = canManageAnnouncements(me.roles);
  const comment = await prisma.initiativeComment.create({
    data: {
      initiativeId: id,
      authorId: me.id,
      parentId: null,
      content: v.content,
      mentions: mentioned as unknown as Prisma.InputJsonValue,
      isOfficial: isCommittee,
    },
  });

  // Push: each tagged resident gets a "mentioned you"; the initiative author
  // gets the usual "new feedback" unless they were tagged (dedupe) or it's
  // their own comment.
  const mentionedIds = mentioned.map((r) => r.id).filter((rid) => rid !== me.id);
  if (mentionedIds.length > 0) {
    sendPushToResidents(mentionedIds, {
      title: "📌 You were mentioned",
      body: `${me.name} mentioned you on “${initiative.title}”`,
      data: { type: "initiative", id },
    }).catch(() => {});
  }
  if (initiative.authorId !== me.id && !mentionedIds.includes(initiative.authorId)) {
    sendPushToResidents([initiative.authorId], {
      title: "💬 New feedback",
      body: `${me.name} commented on “${initiative.title}”`,
      data: { type: "initiative", id },
    }).catch(() => {});
  }

  return NextResponse.json({ id: comment.id }, { status: 201 });
}
