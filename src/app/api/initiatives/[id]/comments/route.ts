import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import { isCommentingOpen, validateComment, type InitiativeStatusValue } from "@/lib/initiatives";

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

  const isCommittee = canManageAnnouncements(me.roles);
  const comment = await prisma.initiativeComment.create({
    data: {
      initiativeId: id,
      authorId: me.id,
      parentId: null,
      content: v.content,
      isOfficial: isCommittee,
    },
  });

  // Notify the initiative author (committee) of new feedback, unless it's their own.
  if (initiative.authorId !== me.id) {
    sendPushToResidents([initiative.authorId], {
      title: "💬 New feedback",
      body: `${me.name} commented on “${initiative.title}”`,
      data: { type: "initiative", id },
    }).catch(() => {});
  }

  return NextResponse.json({ id: comment.id }, { status: 201 });
}
