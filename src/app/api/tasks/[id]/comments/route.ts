import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];
const TASK_ROLES = ["FACILITY_MANAGER", "ADMIN", "SUPERADMIN"];

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
    select: { id: true, isApproved: true, role: { select: { name: true } } },
  });

  if (!resident || !resident.isApproved || !TASK_ROLES.includes(resident.role.name)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, ownerId: true, createdById: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(resident.role.name);
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
