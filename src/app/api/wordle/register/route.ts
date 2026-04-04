import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(request: Request) {
  const body = await request.json();

  // If fromSession is true, auto-register using logged-in user's resident data
  if (body.fromSession) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { name: true, block: true, flatNumber: true, email: true, phone: true },
    });

    if (!resident) {
      return NextResponse.json({ error: "Resident not found" }, { status: 404 });
    }

    const player = await prisma.wordlePlayer.upsert({
      where: { email: resident.email.toLowerCase() },
      update: {},
      create: {
        name: resident.name,
        block: resident.block,
        flatNumber: resident.flatNumber,
        email: resident.email.toLowerCase(),
        phone: resident.phone,
      },
    });

    return NextResponse.json({ playerId: player.id, name: player.name });
  }

  // Manual registration for non-logged-in users
  const { name, block, flatNumber, email, phone } = body;

  if (!name?.trim() || !block || !flatNumber?.trim() || !email?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  const player = await prisma.wordlePlayer.upsert({
    where: { email: emailLower },
    update: {},
    create: {
      name: name.trim(),
      block: Number(block),
      flatNumber: flatNumber.trim(),
      email: emailLower,
      phone: phone.trim(),
    },
  });

  return NextResponse.json({ playerId: player.id, name: player.name });
}
