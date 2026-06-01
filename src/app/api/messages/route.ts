import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { orderPair, myLastReadAt } from "@/lib/messages";

export const dynamic = "force-dynamic";

// GET /api/messages → my conversation list (non-hidden), newest activity first.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const convs = await prisma.conversation.findMany({
    where: {
      OR: [
        { aId: me.id, aHiddenAt: null },
        { bId: me.id, bHiddenAt: null },
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      a: { select: { id: true, name: true, block: true, flatNumber: true, googleImage: true } },
      b: { select: { id: true, name: true, block: true, flatNumber: true, googleImage: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  // unread per conv = incoming messages newer than my lastReadAt
  const result = await Promise.all(
    convs.map(async (c) => {
      const other = c.aId === me.id ? c.b : c.a;
      const lastRead = myLastReadAt(c, me.id);
      const unreadCount = await prisma.directMessage.count({
        where: {
          conversationId: c.id,
          senderId: { not: me.id },
          ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
        },
      });
      const last = c.messages[0];
      return {
        id: c.id,
        other: {
          id: other.id,
          name: other.name,
          block: other.block,
          flatNumber: other.flatNumber,
          googleImage: other.googleImage,
        },
        lastMessage: last
          ? { body: last.body, createdAt: last.createdAt.toISOString(), fromMe: last.senderId === me.id }
          : null,
        lastMessageAt: c.lastMessageAt.toISOString(),
        unreadCount,
      };
    })
  );

  return NextResponse.json({ conversations: result });
}

// POST /api/messages {residentId} → start-or-get a conversation with that resident.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const residentId = typeof body?.residentId === "string" ? body.residentId : "";
  if (!residentId) return NextResponse.json({ error: "Missing residentId" }, { status: 400 });
  if (residentId === me.id) return NextResponse.json({ error: "You can't message yourself" }, { status: 400 });

  const other = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { id: true, isApproved: true },
  });
  if (!other || !other.isApproved) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const [aId, bId] = orderPair(me.id, residentId);

  // Canonical upsert — exactly one conversation per pair.
  const conv = await prisma.conversation.upsert({
    where: { aId_bId: { aId, bId } },
    create: { aId, bId },
    update: {}, // exists already — nothing to change
    select: { id: true, aId: true },
  });

  // Un-hide for me (in case I'd hidden it before).
  await prisma.conversation.update({
    where: { id: conv.id },
    data: conv.aId === me.id ? { aHiddenAt: null } : { bHiddenAt: null },
  });

  return NextResponse.json({ id: conv.id }, { status: 201 });
}
