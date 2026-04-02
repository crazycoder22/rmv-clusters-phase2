import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, block, flatNumber, email, phone } = body;

  if (!name?.trim() || !block || !flatNumber?.trim() || !email?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();

  // Upsert: if email exists, return existing player
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
