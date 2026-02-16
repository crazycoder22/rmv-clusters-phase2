import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MANAGER_ROLES = ["FACILITY_MANAGER", "ADMIN", "SUPERADMIN"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: { select: { name: true } } },
  });

  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const isManager = MANAGER_ROLES.includes(resident.role.name);

  const issues = await prisma.issue.findMany({
    where: isManager ? {} : { residentId: resident.id },
    include: {
      resident: {
        select: { name: true, block: true, flatNumber: true },
      },
      closedByResident: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ issues, isManager });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });

  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, category } = body;

  if (!title || !description || !category) {
    return NextResponse.json(
      { error: "Title, description, and category are required" },
      { status: 400 }
    );
  }

  if (!["ELECTRICAL", "PLUMBING", "OTHER"].includes(category)) {
    return NextResponse.json(
      { error: "Category must be ELECTRICAL, PLUMBING, or OTHER" },
      { status: 400 }
    );
  }

  const issue = await prisma.issue.create({
    data: {
      title,
      description,
      category,
      residentId: resident.id,
    },
    include: {
      resident: {
        select: { name: true, block: true, flatNumber: true },
      },
      closedByResident: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json({ success: true, issue }, { status: 201 });
}
