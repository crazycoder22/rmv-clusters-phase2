import { NextResponse } from "next/server";
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

export async function GET() {
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
  if (!["RESIDENT", "ADMIN"].includes(assignRole)) {
    return NextResponse.json(
      { error: "Role must be RESIDENT or ADMIN" },
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
      googleImage: null,
      roleId: role.id,
    },
    include: { role: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident }, { status: 201 });
}
