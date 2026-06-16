import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";
import { validateInitiative, type InitiativeAttachment } from "@/lib/initiatives";

export const dynamic = "force-dynamic";

// GET /api/initiatives → list (newest first), excludes ARCHIVED
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const initiatives = await prisma.initiative.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { name: true, block: true, flatNumber: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({
    canCreate: canManageAnnouncements(me.roles),
    initiatives: initiatives.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      commentsCloseAt: i.commentsCloseAt.toISOString(),
      isOpen: i.status === "OPEN" && i.commentsCloseAt.getTime() > now.getTime(),
      commentCount: i._count.comments,
      imageUrl: i.imageUrl,
      attachmentCount: (i.attachments as unknown as InitiativeAttachment[]).length,
      author: i.author,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

// POST /api/initiatives → create (committee only)
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(me.roles)) {
    return NextResponse.json({ error: "Only committee members can post initiatives" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const v = validateInitiative(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const initiative = await prisma.initiative.create({
    data: {
      authorId: me.id,
      title: v.data.title,
      body: v.data.body,
      imageUrl: v.data.imageUrl,
      youtubeUrl: v.data.youtubeUrl,
      attachments: v.data.attachments as unknown as Prisma.InputJsonValue,
      commentsCloseAt: v.data.commentsCloseAt,
    },
  });

  // Broadcast to all approved residents (best-effort).
  sendPushToResidents(null, {
    title: "📋 New community initiative",
    body: v.data.title,
    data: { type: "initiative", id: initiative.id },
  }).catch(() => {});

  return NextResponse.json({ id: initiative.id }, { status: 201 });
}
