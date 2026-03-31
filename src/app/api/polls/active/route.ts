import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polls = await prisma.poll.findMany({
    where: {
      status: "ACTIVE",
      deadline: { gt: new Date() },
      surveyId: null,
    },
    select: {
      id: true,
      title: true,
      type: true,
      deadline: true,
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json({ polls });
}
