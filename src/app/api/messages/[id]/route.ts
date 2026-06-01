import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { myLastReadAt, otherLastReadAt, setMyLastReadData, setMyHiddenData } from "@/lib/messages";

export const dynamic = "force-dynamic";

const PAGE = 50;

// GET /api/messages/[id] → a conversation's messages (I must be a participant).
// Marks the conversation read for me (conditional cheap write) + un-hides it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      a: { select: { id: true, name: true, block: true, flatNumber: true, googleImage: true } },
      b: { select: { id: true, name: true, block: true, flatNumber: true, googleImage: true } },
    },
  });
  // 404 (not 403) if I'm not a participant — never leak existence.
  if (!conv || (conv.aId !== me.id && conv.bId !== me.id)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const before = new URL(request.url).searchParams.get("before");
  const messages = await prisma.directMessage.findMany({
    where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE,
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  // return ascending (oldest→newest) for rendering
  const ordered = messages.slice().reverse();

  // Mark read: set my lastReadAt only if there's something newer (avoids a
  // write on every 3s poll). Also un-hide for me if I'd hidden it.
  const newest = messages[0]; // newest first
  const mine = myLastReadAt(conv, me.id);
  const needsReadBump = newest && (!mine || newest.createdAt.getTime() > mine.getTime());
  const amHidden = (conv.aId === me.id ? conv.aHiddenAt : conv.bHiddenAt) !== null;
  if (needsReadBump || amHidden) {
    await prisma.conversation.update({
      where: { id },
      data: {
        ...(needsReadBump ? setMyLastReadData(conv, me.id, new Date()) : {}),
        ...(amHidden ? setMyHiddenData(conv, me.id, null) : {}),
      },
    });
  }

  const other = conv.aId === me.id ? conv.b : conv.a;
  return NextResponse.json({
    id: conv.id,
    other: {
      id: other.id,
      name: other.name,
      block: other.block,
      flatNumber: other.flatNumber,
      googleImage: other.googleImage,
    },
    otherLastReadAt: otherLastReadAt(conv, me.id)?.toISOString() ?? null,
    messages: ordered.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      fromMe: m.senderId === me.id,
    })),
    hasMore: messages.length === PAGE,
  });
}

// DELETE /api/messages/[id] → hide the conversation for me only.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const conv = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, aId: true, bId: true },
  });
  if (!conv || (conv.aId !== me.id && conv.bId !== me.id)) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  await prisma.conversation.update({
    where: { id },
    data: setMyHiddenData(conv, me.id, new Date()),
  });
  return NextResponse.json({ ok: true });
}
