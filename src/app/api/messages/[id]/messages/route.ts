import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { validateBody, otherId, setMyLastReadData, clearOtherHiddenData } from "@/lib/messages";

// POST /api/messages/[id]/messages {body} → send a message in this conversation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const payload = await request.json().catch(() => null);
  const v = validateBody(payload?.body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const now = new Date();
  const message = await prisma.directMessage.create({
    data: { conversationId: id, senderId: me.id, body: v.body },
    select: { id: true, body: true, createdAt: true },
  });

  // Bump activity, mark read for me, and resurface for the recipient if hidden.
  await prisma.conversation.update({
    where: { id },
    data: {
      lastMessageAt: now,
      ...setMyLastReadData(conv, me.id, now),
      ...clearOtherHiddenData(conv, me.id),
    },
  });

  // Push the recipient (best-effort).
  const recipientId = otherId(conv, me.id);
  const preview = v.body.length > 120 ? v.body.slice(0, 120) + "…" : v.body;
  sendPushToResidents([recipientId], {
    title: `💬 ${me.name}`,
    body: preview,
    data: { type: "message", id },
  }).catch(() => {});

  return NextResponse.json(
    { id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), fromMe: true },
    { status: 201 }
  );
}
