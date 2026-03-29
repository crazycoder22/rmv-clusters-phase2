import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const acceptances = await prisma.sosAcceptance.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      resident: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ acceptances });
}
