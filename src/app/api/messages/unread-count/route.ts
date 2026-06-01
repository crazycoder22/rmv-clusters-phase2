import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { myLastReadAt } from "@/lib/messages";

export const dynamic = "force-dynamic";

// GET /api/messages/unread-count → total unread across my non-hidden conversations.
// Used for the nav/More badge.
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
    select: { id: true, aId: true, bId: true, aLastReadAt: true, bLastReadAt: true },
  });

  let count = 0;
  for (const c of convs) {
    const lastRead = myLastReadAt(c, me.id);
    const n = await prisma.directMessage.count({
      where: {
        conversationId: c.id,
        senderId: { not: me.id },
        ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
      },
    });
    count += n;
  }

  return NextResponse.json({ count });
}
