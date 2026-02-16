import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
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

  const body = await request.json();

  if (body.notificationId) {
    // Mark single notification as read
    await prisma.notification.updateMany({
      where: { id: body.notificationId, residentId: resident.id },
      data: { read: true },
    });
  } else if (body.markAllRead) {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { residentId: resident.id, read: false },
      data: { read: true },
    });
  }

  return NextResponse.json({ success: true });
}
