import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueMobileJwt, verifyGoogleIdToken } from "@/lib/mobile-auth";

export async function POST(req: Request) {
  let body: { idToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken : null;
  if (!idToken) {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "invalid_id_token" }, { status: 401 });
  }

  if (!identity.emailVerified) {
    return NextResponse.json({ error: "email_not_verified" }, { status: 403 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: identity.email },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      block: true,
      flatNumber: true,
      isApproved: true,
      googleImage: true,
      roles: { select: { name: true } },
    },
  });

  if (!resident) {
    return NextResponse.json(
      { error: "not_registered", email: identity.email },
      { status: 403 }
    );
  }

  if (!resident.isApproved) {
    return NextResponse.json(
      { error: "not_approved", email: identity.email },
      { status: 403 }
    );
  }

  if (identity.picture && identity.picture !== resident.googleImage) {
    await prisma.resident
      .update({
        where: { id: resident.id },
        data: { googleImage: identity.picture },
      })
      .catch(() => {
        // non-fatal — just a cosmetic refresh
      });
  }

  // Ensure a WordlePlayer row exists for this resident — that's the model
  // game scores (memory, wordle, sudoku, etc.) are keyed by.
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
    select: { id: true },
  });

  const token = await issueMobileJwt({
    sub: resident.id,
    email: resident.email,
  });

  return NextResponse.json({
    token,
    user: {
      id: resident.id,
      email: resident.email,
      name: resident.name,
      phone: resident.phone,
      block: resident.block,
      flatNumber: resident.flatNumber,
      imageUrl: identity.picture ?? resident.googleImage ?? null,
      roles: resident.roles.map((r) => r.name),
      playerId: player.id,
    },
  });
}
