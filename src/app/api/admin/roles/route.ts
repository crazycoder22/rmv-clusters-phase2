import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { residentId, roles: newRoles } = body;

  if (!residentId || !Array.isArray(newRoles)) {
    return NextResponse.json(
      { error: "residentId and roles array are required" },
      { status: 400 }
    );
  }

  if (newRoles.includes("SUPERADMIN")) {
    return NextResponse.json(
      { error: "Cannot assign SUPERADMIN role via UI" },
      { status: 400 }
    );
  }

  const validRoles = ["RESIDENT", "ADMIN", "COMMUNITY_ADMIN", "SECURITY", "FACILITY_MANAGER", "EVENT_MANAGER"];
  if (newRoles.some((r: string) => !validRoles.includes(r))) {
    return NextResponse.json(
      { error: "Invalid role name" },
      { status: 400 }
    );
  }

  // Filter out RESIDENT (it's implicit)
  const nonResidentRoles = newRoles.filter((r: string) => r !== "RESIDENT");

  // Verify resident exists
  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
  });
  if (!resident) {
    return NextResponse.json(
      { error: "Resident not found" },
      { status: 404 }
    );
  }

  // Look up role records
  const roleRecords = nonResidentRoles.length > 0
    ? await prisma.role.findMany({
        where: { name: { in: nonResidentRoles } },
      })
    : [];

  if (roleRecords.length !== nonResidentRoles.length) {
    return NextResponse.json(
      { error: "System error: one or more roles not found" },
      { status: 500 }
    );
  }

  // Use 'set' to replace all roles atomically
  const updated = await prisma.resident.update({
    where: { id: residentId },
    data: {
      roles: {
        set: roleRecords.map((r) => ({ id: r.id })),
      },
    },
    include: { roles: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident: updated });
}
