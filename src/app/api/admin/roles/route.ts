import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";
import { isValidResidentType } from "@/lib/resident-types";
import { getAuthedResident } from "@/lib/api-auth";

// PATCH /api/admin/roles — SUPERADMIN-only.
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function PATCH(request: Request) {
  const me = await getAuthedResident(request);

  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { residentId, roles: newRoles, residentType, isSosWarrior, action } = body;

  // Handle deactivate / reactivate (soft delete).
  if (residentId && (action === "deactivate" || action === "reactivate")) {
    if (residentId === me.id) {
      return NextResponse.json(
        { error: "You can't deactivate your own account." },
        { status: 400 }
      );
    }
    const target = await prisma.resident.findUnique({
      where: { id: residentId },
      include: { roles: { select: { name: true } } },
    });
    if (!target) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }
    if (target.roles.some((r) => r.name === "SUPERADMIN")) {
      return NextResponse.json(
        { error: "Cannot deactivate a SUPERADMIN." },
        { status: 400 }
      );
    }
    const deactivate = action === "deactivate";
    const updated = await prisma.resident.update({
      where: { id: residentId },
      data: deactivate
        ? { deactivatedAt: new Date(), isApproved: false }
        : { deactivatedAt: null, isApproved: true },
      include: { roles: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, resident: updated });
  }

  // Handle isSosWarrior toggle
  if (residentId && typeof isSosWarrior === "boolean" && !newRoles && !residentType) {
    const updated = await prisma.resident.update({
      where: { id: residentId },
      data: { isSosWarrior },
      include: { roles: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, resident: updated });
  }

  // Handle residentType-only update
  if (residentId && residentType && !newRoles) {
    if (!isValidResidentType(residentType)) {
      return NextResponse.json({ error: "Invalid resident type" }, { status: 400 });
    }
    const updated = await prisma.resident.update({
      where: { id: residentId },
      data: { residentType },
      include: { roles: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, resident: updated });
  }

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

// DELETE /api/admin/roles — SUPERADMIN-only hard delete of a resident.
// Permanently removes the resident row (and cascade-linked data). Fails with
// 409 if the resident has activity that blocks deletion — the admin should
// deactivate them instead.
export async function DELETE(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { residentId } = body as { residentId?: string };
  if (!residentId) {
    return NextResponse.json({ error: "residentId is required" }, { status: 400 });
  }
  if (residentId === me.id) {
    return NextResponse.json(
      { error: "You can't delete your own account." },
      { status: 400 }
    );
  }

  const target = await prisma.resident.findUnique({
    where: { id: residentId },
    include: { roles: { select: { name: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }
  if (target.roles.some((r) => r.name === "SUPERADMIN")) {
    return NextResponse.json(
      { error: "Cannot delete a SUPERADMIN." },
      { status: 400 }
    );
  }

  try {
    await prisma.resident.delete({ where: { id: residentId } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    // P2003 = foreign-key constraint: the resident still owns records that
    // don't cascade (posts, bookings they created, etc.).
    const code = (e as { code?: string })?.code;
    if (code === "P2003" || code === "P2014") {
      return NextResponse.json(
        {
          error:
            "This resident has activity (posts, bookings, etc.) that prevents a hard delete. Deactivate them instead.",
        },
        { status: 409 }
      );
    }
    console.error("[admin/roles] hard-delete failed", e);
    return NextResponse.json({ error: "Could not delete resident." }, { status: 500 });
  }
}
