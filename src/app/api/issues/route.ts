import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin as checkIsAdmin, hasExactRole } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManager =
    checkIsAdmin(resident.roles) || hasExactRole(resident.roles, "FACILITY_MANAGER");
  // FM only manages, others can also raise issues
  const canRaise =
    !hasExactRole(resident.roles, "FACILITY_MANAGER") || checkIsAdmin(resident.roles);

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

  return NextResponse.json({ issues, isManager, canRaise });
}

export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  // Facility managers (who are not also admins) cannot raise issues
  if (
    hasExactRole(resident.roles, "FACILITY_MANAGER") &&
    !checkIsAdmin(resident.roles)
  ) {
    return NextResponse.json(
      { error: "Facility managers cannot raise issues" },
      { status: 403 }
    );
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

  // Notify all facility managers
  const facilityManagers = await prisma.resident.findMany({
    where: { roles: { some: { name: "FACILITY_MANAGER" } }, isApproved: true },
    select: { id: true },
  });

  if (facilityManagers.length > 0) {
    await prisma.notification.createMany({
      data: facilityManagers.map((fm) => ({
        residentId: fm.id,
        issueId: issue.id,
      })),
    });
  }

  return NextResponse.json({ success: true, issue }, { status: 201 });
}
