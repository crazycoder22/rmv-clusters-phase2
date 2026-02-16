import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pending = searchParams.get("pending");

  // Pending approvals can be viewed by ADMIN or SUPERADMIN
  if (pending === "true") {
    const check = await requireAdmin();
    if ("error" in check && check.error) return check.error;

    const residents = await prisma.resident.findMany({
      where: { isApproved: false },
      include: { role: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ residents });
  }

  // Full resident list requires SUPERADMIN
  const check = await requireSuperAdmin();
  if ("error" in check && check.error) return check.error;

  const residents = await prisma.resident.findMany({
    include: { role: { select: { name: true } } },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  return NextResponse.json({ residents });
}

export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { name, email, phone, block, flatNumber, residentType, roleName } = body;

  // Validate required fields
  if (!name || !email || !phone || !block || !flatNumber || !residentType) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  // Validate email format
  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }

  if (![1, 2, 3, 4].includes(Number(block))) {
    return NextResponse.json(
      { error: "Block must be 1, 2, 3, or 4" },
      { status: 400 }
    );
  }

  if (!["OWNER", "TENANT"].includes(residentType)) {
    return NextResponse.json(
      { error: "Invalid resident type" },
      { status: 400 }
    );
  }

  const assignRole = roleName || "RESIDENT";
  if (!["RESIDENT", "ADMIN", "SECURITY"].includes(assignRole)) {
    return NextResponse.json(
      { error: "Role must be RESIDENT, ADMIN, or SECURITY" },
      { status: 400 }
    );
  }

  // Check duplicate email
  const existing = await prisma.resident.findUnique({
    where: { email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 }
    );
  }

  // Look up role
  const role = await prisma.role.findUnique({
    where: { name: assignRole },
  });
  if (!role) {
    return NextResponse.json(
      { error: "System error: role not found" },
      { status: 500 }
    );
  }

  const resident = await prisma.resident.create({
    data: {
      email,
      name,
      phone,
      block: Number(block),
      flatNumber,
      residentType,
      isApproved: true, // Admin-created residents are auto-approved
      googleImage: null,
      roleId: role.id,
    },
    include: { role: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident }, { status: 201 });
}

export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { residentId, action } = body;

  if (!residentId || !action) {
    return NextResponse.json(
      { error: "residentId and action are required" },
      { status: 400 }
    );
  }

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
  });

  if (!resident) {
    return NextResponse.json(
      { error: "Resident not found" },
      { status: 404 }
    );
  }

  if (action === "approve") {
    const updated = await prisma.resident.update({
      where: { id: residentId },
      data: { isApproved: true },
      include: { role: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, resident: updated });
  }

  // Reject: delete the resident record so they can re-register
  await prisma.resident.delete({
    where: { id: residentId },
  });

  return NextResponse.json({ success: true, action: "rejected" });
}
