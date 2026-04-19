import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin, isAdmin, canManageResidents } from "@/lib/roles";
import { isValidResidentType } from "@/lib/resident-types";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isSuperAdmin(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function requireResidentManager() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageResidents(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdmin(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pending = searchParams.get("pending");
  const isSearch = searchParams.has("search");

  // Pending approvals can be viewed by anyone who can manage residents
  if (pending === "true") {
    const check = await requireResidentManager();
    if ("error" in check && check.error) return check.error;

    const residents = await prisma.resident.findMany({
      where: { isApproved: false },
      include: { roles: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ residents });
  }

  // Search mode (admin)
  if (isSearch) {
    const check = await requireAdmin();
    if ("error" in check && check.error) return check.error;

    const q = (searchParams.get("q") ?? "").trim();
    const blockStr = searchParams.get("block");
    const flatNumber = (searchParams.get("flatNumber") ?? "").trim();

    const where: Prisma.ResidentWhereInput = {};
    if (blockStr && ["1", "2", "3", "4"].includes(blockStr)) {
      where.block = parseInt(blockStr, 10);
    }
    if (flatNumber) {
      where.flatNumber = { contains: flatNumber, mode: "insensitive" };
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ];
    }

    const residents = await prisma.resident.findMany({
      where,
      include: { roles: { select: { name: true } } },
      orderBy: [{ block: "asc" }, { flatNumber: "asc" }, { name: "asc" }],
      take: 200,
    });

    return NextResponse.json({ residents, truncated: residents.length === 200 });
  }

  // Full resident list requires SUPERADMIN
  const check = await requireSuperAdmin();
  if ("error" in check && check.error) return check.error;

  const residents = await prisma.resident.findMany({
    include: { roles: { select: { name: true } } },
    orderBy: [{ block: "asc" }, { flatNumber: "asc" }],
  });

  return NextResponse.json({ residents });
}

export async function POST(request: Request) {
  const check = await requireResidentManager();
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

  // Validate flat exists in the Flat table
  const flatExists = await prisma.flat.findUnique({
    where: { block_flatNumber: { block: Number(block), flatNumber } },
  });
  if (!flatExists) {
    return NextResponse.json(
      { error: "Invalid flat number for the selected block" },
      { status: 400 }
    );
  }

  if (!isValidResidentType(residentType)) {
    return NextResponse.json(
      { error: "Invalid resident type" },
      { status: 400 }
    );
  }

  const assignRole = roleName || "RESIDENT";
  if (!["RESIDENT", "ADMIN", "COMMUNITY_ADMIN", "SECURITY", "FACILITY_MANAGER", "EVENT_MANAGER"].includes(assignRole)) {
    return NextResponse.json(
      { error: "Invalid role" },
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

  // Build roles connection (RESIDENT is implicit, don't connect it)
  const rolesConnect = assignRole !== "RESIDENT"
    ? { roles: { connect: [{ name: assignRole }] } }
    : {};

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
      ...rolesConnect,
    },
    include: { roles: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident }, { status: 201 });
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { residentId, name, email, phone, block, flatNumber, residentType, isApproved } = body;

  if (!residentId) {
    return NextResponse.json({ error: "residentId is required" }, { status: 400 });
  }

  const existing = await prisma.resident.findUnique({ where: { id: residentId } });
  if (!existing) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const updateData: Prisma.ResidentUpdateInput = {};

  if (typeof name === "string" && name.trim()) updateData.name = name.trim();

  if (typeof email === "string" && email.trim()) {
    const lower = email.trim().toLowerCase();
    if (!lower.includes("@") || !lower.includes(".")) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (lower !== existing.email.toLowerCase()) {
      const dupe = await prisma.resident.findUnique({ where: { email: lower } });
      if (dupe && dupe.id !== residentId) {
        return NextResponse.json(
          { error: `Email already used by ${dupe.name}` },
          { status: 409 }
        );
      }
      updateData.email = lower;
    }
  }

  if (typeof phone === "string" && phone.trim()) updateData.phone = phone.trim();

  // block + flatNumber must be validated together against the Flat table
  const blockChanged = block !== undefined && Number(block) !== existing.block;
  const flatChanged = typeof flatNumber === "string" && flatNumber.trim() !== existing.flatNumber;

  if (blockChanged || flatChanged) {
    const newBlock = block !== undefined ? Number(block) : existing.block;
    const newFlat = (typeof flatNumber === "string" ? flatNumber.trim() : existing.flatNumber);

    if (![1, 2, 3, 4].includes(newBlock)) {
      return NextResponse.json({ error: "Block must be 1, 2, 3, or 4" }, { status: 400 });
    }
    const flatExists = await prisma.flat.findUnique({
      where: { block_flatNumber: { block: newBlock, flatNumber: newFlat } },
    });
    if (!flatExists) {
      return NextResponse.json(
        { error: `Flat ${newBlock}-${newFlat} does not exist` },
        { status: 400 }
      );
    }
    updateData.block = newBlock;
    updateData.flatNumber = newFlat;
  }

  if (residentType !== undefined) {
    if (!isValidResidentType(residentType)) {
      return NextResponse.json({ error: "Invalid resident type" }, { status: 400 });
    }
    updateData.residentType = residentType;
  }

  if (typeof isApproved === "boolean") updateData.isApproved = isApproved;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.resident.update({
    where: { id: residentId },
    data: updateData,
    include: { roles: { select: { name: true } } },
  });

  return NextResponse.json({ success: true, resident: updated });
}

export async function PATCH(request: Request) {
  const check = await requireResidentManager();
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
      include: { roles: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, resident: updated });
  }

  // Reject: delete the resident record so they can re-register
  await prisma.resident.delete({
    where: { id: residentId },
  });

  return NextResponse.json({ success: true, action: "rejected" });
}
