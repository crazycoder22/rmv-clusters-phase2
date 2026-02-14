import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent duplicate registration
  const existing = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Already registered" },
      { status: 409 }
    );
  }

  const body = await request.json();
  const { phone, block, flatNumber, residentType } = body;

  // Server-side validation
  if (!phone || !block || !flatNumber || !residentType) {
    return NextResponse.json(
      { error: "All fields are required" },
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

  // Get the default RESIDENT role
  const residentRole = await prisma.role.findUnique({
    where: { name: "RESIDENT" },
  });

  if (!residentRole) {
    return NextResponse.json(
      { error: "System error: default role not found" },
      { status: 500 }
    );
  }

  const resident = await prisma.resident.create({
    data: {
      email: session.user.email,
      name: session.user.name ?? "",
      phone,
      block: Number(block),
      flatNumber,
      residentType,
      googleImage: session.user.image ?? null,
      roleId: residentRole.id,
    },
  });

  return NextResponse.json(
    { success: true, id: resident.id },
    { status: 201 }
  );
}
