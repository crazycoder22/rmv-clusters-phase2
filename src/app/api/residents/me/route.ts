import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      block: true,
      flatNumber: true,
      googleImage: true,
      isApproved: true,
    },
  });

  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  return NextResponse.json(resident);
}
