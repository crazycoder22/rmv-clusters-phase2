import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTasks, isAdmin as checkIsAdmin } from "@/lib/roles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true, roles: { select: { name: true } } },
  });

  const roleNames = resident?.roles.map((r) => r.name) ?? [];
  if (!resident || !resident.isApproved || !canAccessTasks(roleNames)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, ownerId: true, createdById: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isAdmin = checkIsAdmin(roleNames);
  if (!isAdmin && task.ownerId !== resident.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 }
    );
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId: id,
      authorId: resident.id,
      content: content.trim(),
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
  });

  // Notify the other party
  const notifyResidentId =
    resident.id === task.ownerId ? task.createdById : task.ownerId;

  await prisma.notification.create({
    data: {
      residentId: notifyResidentId,
      taskId: id,
    },
  });

  return NextResponse.json({ success: true, comment }, { status: 201 });
}
