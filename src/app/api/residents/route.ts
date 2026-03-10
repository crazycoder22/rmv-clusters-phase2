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

  if (!["OWNER", "TENANT"].includes(residentType)) {
    return NextResponse.json(
      { error: "Invalid resident type" },
      { status: 400 }
    );
  }

  // RESIDENT role is implicit — no roles connection needed
  const resident = await prisma.resident.create({
    data: {
      email: session.user.email,
      name: session.user.name ?? "",
      phone,
      block: Number(block),
      flatNumber,
      residentType,
      googleImage: session.user.image ?? null,
    },
  });

  return NextResponse.json(
    { success: true, id: resident.id },
    { status: 201 }
  );
}
