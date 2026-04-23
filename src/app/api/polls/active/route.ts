import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
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
