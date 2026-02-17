import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];
const TASK_ROLES = ["FACILITY_MANAGER", "ADMIN", "SUPERADMIN"];

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["ON_HOLD", "BLOCKED", "CLOSED"],
  ON_HOLD: ["IN_PROGRESS", "CLOSED"],
  BLOCKED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: ["OPEN"], // reopen - admin only
};

export async function GET(
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
    include: {
      owner: {
        select: { id: true, name: true, block: true, flatNumber: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
      comments: {
        include: {
          author: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(resident.role.name);
  if (!isAdmin && task.ownerId !== resident.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({ task, isAdmin });
}

export async function PATCH(
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
    select: { id: true, status: true, ownerId: true, createdById: true },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const isAdmin = ADMIN_ROLES.includes(resident.role.name);
  if (!isAdmin && task.ownerId !== resident.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json();
  const { status: newStatus, comment } = body;

  // Status change
  if (newStatus && newStatus !== task.status) {
    const allowedTransitions = VALID_TRANSITIONS[task.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${task.status} to ${newStatus}` },
        { status: 400 }
      );
    }

    // Only admins can reopen
    if (task.status === "CLOSED" && newStatus === "OPEN" && !isAdmin) {
      return NextResponse.json(
        { error: "Only admins can reopen tasks" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === "CLOSED") {
      updateData.closedAt = new Date();
    }
    if (task.status === "CLOSED" && newStatus === "OPEN") {
      updateData.closedAt = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, name: true, block: true, flatNumber: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    // Create status change comment
    await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: resident.id,
        content: comment || `Status changed from ${task.status} to ${newStatus}`,
        oldStatus: task.status,
        newStatus,
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

    return NextResponse.json({ success: true, task: updatedTask });
  }

  // Comment only (no status change)
  if (comment) {
    await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: resident.id,
        content: comment,
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

    const updatedTask = await prisma.task.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, block: true, flatNumber: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    });

    return NextResponse.json({ success: true, task: updatedTask });
  }

  return NextResponse.json({ error: "No changes provided" }, { status: 400 });
}
