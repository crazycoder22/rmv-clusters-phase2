import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { residentId, newRoleName } = body;

  if (!residentId || !newRoleName) {
    return NextResponse.json(
      { error: "residentId and newRoleName are required" },
      { status: 400 }
    );
  }

  if (!["RESIDENT", "ADMIN", "SECURITY", "FACILITY_MANAGER"].includes(newRoleName)) {
    return NextResponse.json(
      { error: "Cannot assign SUPERADMIN role via UI" },
      { status: 400 }
    );
  }

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

  // Look up new role
  const role = await prisma.role.findUnique({
    where: { name: newRoleName },
  });
  if (!role) {
    return NextResponse.json(
      { error: "System error: role not found" },
      { status: 500 }
    );
  }

  const updated = await prisma.resident.update({
    where: { id: residentId },
    data: { roleId: role.id },
    include: { role: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident: updated });
}
