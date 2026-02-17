import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const notifications = await prisma.notification.findMany({
    where: { residentId: resident.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      announcement: {
        select: { id: true, title: true, category: true },
      },
      visitor: {
        select: { id: true, name: true, status: true },
      },
      issue: {
        select: { id: true, title: true, category: true, status: true },
      },
    },
  });

  return NextResponse.json({ notifications });
}
