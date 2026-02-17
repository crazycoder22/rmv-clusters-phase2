import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];
const TASK_ROLES = ["FACILITY_MANAGER", "ADMIN", "SUPERADMIN"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true, role: { select: { name: true } } },
  });

  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const roleName = resident.role.name;
  if (!TASK_ROLES.includes(roleName)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const isAdmin = ADMIN_ROLES.includes(roleName);
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (!isAdmin) {
    where.ownerId = resident.id;
  }
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  const tasks = await prisma.task.findMany({
    where,
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
    orderBy: { createdAt: "desc" },
  });

  // If admin, also return facility managers list for the create form
  let facilityManagers: { id: string; name: string }[] = [];
  if (isAdmin) {
    facilityManagers = await prisma.resident.findMany({
      where: { role: { name: "FACILITY_MANAGER" }, isApproved: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return NextResponse.json({ tasks, isAdmin, facilityManagers });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true, role: { select: { name: true } } },
  });

  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  if (!ADMIN_ROLES.includes(resident.role.name)) {
    return NextResponse.json(
      { error: "Only admins can create tasks" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { title, description, category, priority, ownerId, deadline } = body;

  if (!title || !description || !category || !ownerId || !deadline) {
    return NextResponse.json(
      { error: "Title, description, category, owner, and deadline are required" },
      { status: 400 }
    );
  }

  const validCategories = ["MAINTENANCE", "ELECTRICAL", "PLUMBING", "SECURITY", "GENERAL"];
  if (!validCategories.includes(category)) {
    return NextResponse.json(
      { error: `Category must be one of: ${validCategories.join(", ")}` },
      { status: 400 }
    );
  }

  const validPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
  if (priority && !validPriorities.includes(priority)) {
    return NextResponse.json(
      { error: `Priority must be one of: ${validPriorities.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate owner is an approved FM
  const owner = await prisma.resident.findUnique({
    where: { id: ownerId },
    select: { id: true, isApproved: true, role: { select: { name: true } } },
  });

  if (!owner || !owner.isApproved || owner.role.name !== "FACILITY_MANAGER") {
    return NextResponse.json(
      { error: "Owner must be an approved Facility Manager" },
      { status: 400 }
    );
  }

  const task = await prisma.task.create({
    data: {
      title,
      description,
      category,
      priority: priority || "NORMAL",
      deadline: new Date(deadline),
      createdById: resident.id,
      ownerId,
    },
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

  // Notify the assigned FM
  await prisma.notification.create({
    data: {
      residentId: ownerId,
      taskId: task.id,
    },
  });

  return NextResponse.json({ success: true, task }, { status: 201 });
}
