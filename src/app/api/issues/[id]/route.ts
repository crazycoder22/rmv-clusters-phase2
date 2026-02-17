import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MANAGER_ROLES = ["FACILITY_MANAGER", "ADMIN", "SUPERADMIN"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: { select: { name: true } } },
  });

  if (!resident || !MANAGER_ROLES.includes(resident.role.name)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (issue.status === "CLOSED") {
    return NextResponse.json(
      { error: "Issue is already closed" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { closureComment } = body;

  if (!closureComment || !closureComment.trim()) {
    return NextResponse.json(
      { error: "Closure comment is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedBy: resident.id,
      closureComment: closureComment.trim(),
      closedAt: new Date(),
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

  // Notify the resident who raised the issue
  await prisma.notification.create({
    data: {
      residentId: issue.residentId,
      issueId: issue.id,
    },
  });

  return NextResponse.json({ success: true, issue: updated });
}
