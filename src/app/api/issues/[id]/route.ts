import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin as checkIsAdmin, hasExactRole } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      resident: { select: { name: true, block: true, flatNumber: true } },
      closedByResident: { select: { name: true } },
    },
  });
  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  // Authors and managers can view; everyone else gets 403.
  const isManager =
    checkIsAdmin(resident.roles) ||
    hasExactRole(resident.roles, "FACILITY_MANAGER");
  if (issue.residentId !== resident.id && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ issue, isManager });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    checkIsAdmin(resident.roles) ||
    hasExactRole(resident.roles, "FACILITY_MANAGER");
  if (!isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id } });
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
      resident: { select: { name: true, block: true, flatNumber: true } },
      closedByResident: { select: { name: true } },
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
