import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ accepted: false });
  }

  const record = await prisma.sosAcceptance.findUnique({
    where: { email: session.user.email },
  });

  return NextResponse.json({ accepted: !!record });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, phone, block, flatNumber } = body;

  if (!name || !email || !phone || !block || !flatNumber) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  const blockNum = parseInt(block);
  if (isNaN(blockNum) || blockNum < 1 || blockNum > 4) {
    return NextResponse.json({ error: "Invalid block" }, { status: 400 });
  }

  // Check if already accepted
  const existing = await prisma.sosAcceptance.findUnique({
    where: { email },
  });
  if (existing) {
    return NextResponse.json({ accepted: true });
  }

  // Check if user is logged in to link residentId
  const session = await auth();
  let residentId: string | null = null;
  if (session?.user?.email) {
    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    residentId = resident?.id ?? null;
  }

  await prisma.sosAcceptance.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      block: blockNum,
      flatNumber: flatNumber.trim(),
      residentId,
    },
  });

  return NextResponse.json({ accepted: true });
}
