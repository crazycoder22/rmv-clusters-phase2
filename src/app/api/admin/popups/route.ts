import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const popups = await prisma.sitePopup.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ popups });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, message, active, startsAt, expiresAt } = body;

  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const popup = await prisma.sitePopup.create({
    data: {
      title: title.trim(),
      message: message.trim(),
      active: active ?? true,
      startsAt: startsAt ? new Date(startsAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ popup });
}
