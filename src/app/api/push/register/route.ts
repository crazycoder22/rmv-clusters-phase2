import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST /api/push/register — mobile app posts its device token here after
// the user has granted notification permission. Idempotent: re-posting the
// same token just updates lastSeenAt. If the same token was previously
// owned by a different resident (someone signs into the app on a shared
// phone), we transfer the token to the new resident so notifications go
// to whoever is currently signed in.
//
// Body: { token: string, platform: "ios" | "android" | "web" }
//
// Auth: mobile bearer JWT (NextAuth cookie also accepted for symmetry).
export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { token, platform } = body as { token?: string; platform?: string };
  if (!token || typeof token !== "string" || token.length < 10) {
    return NextResponse.json(
      { error: "token is required" },
      { status: 400 }
    );
  }
  const plat = platform === "android" || platform === "web" ? platform : "ios";

  await prisma.deviceToken.upsert({
    where: { token },
    create: {
      token,
      platform: plat,
      residentId: resident.id,
    },
    update: {
      residentId: resident.id, // reassign if a different user signs in
      platform: plat,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/register?token=… — explicit unregister, used on sign-out
// or when the user disables notifications. Body-less to keep the mobile
// fetch helpers simple.
export async function DELETE(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  // Only allow a user to delete their own tokens — we don't want one
  // resident wiping someone else's tokens via a guessed value.
  await prisma.deviceToken.deleteMany({
    where: { token, residentId: resident.id },
  });

  return NextResponse.json({ ok: true });
}
