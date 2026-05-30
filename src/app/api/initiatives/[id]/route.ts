import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { validateInitiative, type InitiativeStatusValue } from "@/lib/initiatives";

export const dynamic = "force-dynamic";

type CommentWithRel = {
  id: string;
  authorId: string;
  content: string;
  isOfficial: boolean;
  createdAt: Date;
  author: { name: string; block: number | null; flatNumber: string };
  likes: { residentId: string }[];
};

function serializeComment(c: CommentWithRel, meId: string) {
  return {
    id: c.id,
    content: c.content,
    isOfficial: c.isOfficial,
    createdAt: c.createdAt.toISOString(),
    author: c.author,
    isMine: c.authorId === meId,
    likeCount: c.likes.length,
    myLiked: c.likes.some((l) => l.residentId === meId),
  };
}

// GET /api/initiatives/[id] → initiative + comment tree
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const now = new Date();

  const initiative = await prisma.initiative.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, block: true, flatNumber: true } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { name: true, block: true, flatNumber: true } },
          likes: { select: { residentId: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { name: true, block: true, flatNumber: true } },
              likes: { select: { residentId: true } },
            },
          },
        },
      },
    },
  });
  if (!initiative) return NextResponse.json({ error: "Initiative not found" }, { status: 404 });

  const isCommittee = canManageAnnouncements(me.roles);
  const isOpen = initiative.status === "OPEN" && initiative.commentsCloseAt.getTime() > now.getTime();

  return NextResponse.json({
    id: initiative.id,
    title: initiative.title,
    body: initiative.body,
    imageUrl: initiative.imageUrl,
    status: initiative.status,
    commentsCloseAt: initiative.commentsCloseAt.toISOString(),
    isOpen,
    createdAt: initiative.createdAt.toISOString(),
    author: {
      id: initiative.author.id,
      name: initiative.author.name,
      block: initiative.author.block,
      flatNumber: initiative.author.flatNumber,
    },
    isCommittee,
    canManage: isCommittee || initiative.author.id === me.id,
    comments: initiative.comments.map((c) => ({
      ...serializeComment(c as CommentWithRel, me.id),
      replies: c.replies.map((r) => serializeComment(r as CommentWithRel, me.id)),
    })),
  });
}

// PATCH /api/initiatives/[id] → edit (author or committee)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const initiative = await prisma.initiative.findUnique({ where: { id }, select: { authorId: true } });
  if (!initiative) return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
  if (initiative.authorId !== me.id && !canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  // status-only update (close early / archive / reopen)
  if (typeof body.status === "string") {
    const s = body.status as InitiativeStatusValue;
    if (!["OPEN", "CLOSED", "ARCHIVED"].includes(s)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = s;
  }

  // content fields — validate together only if any provided
  if ("title" in body || "body" in body || "commentsCloseAt" in body || "imageUrl" in body) {
    const v = validateInitiative(
      {
        title: body.title,
        body: body.body,
        commentsCloseAt: body.commentsCloseAt,
        imageUrl: body.imageUrl,
      },
      // allow keeping an existing (possibly past) deadline only when it's unchanged;
      // validateInitiative requires a future deadline, so callers editing other
      // fields must resend a valid future deadline. The edit form does this.
      new Date()
    );
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    data.title = v.data.title;
    data.body = v.data.body;
    data.imageUrl = v.data.imageUrl;
    data.commentsCloseAt = v.data.commentsCloseAt;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.initiative.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/initiatives/[id] → author or committee
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const initiative = await prisma.initiative.findUnique({ where: { id }, select: { authorId: true } });
  if (!initiative) return NextResponse.json({ error: "Initiative not found" }, { status: 404 });
  if (initiative.authorId !== me.id && !canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.initiative.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
