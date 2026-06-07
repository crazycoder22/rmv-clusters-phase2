import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/me → the current resident's profile + preferences (for refresh).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    id: me.id,
    name: me.name,
    block: me.block,
    flatNumber: me.flatNumber,
    isApproved: me.isApproved,
    isSeniorCitizen: me.isSeniorCitizen,
    roles: me.roles,
  });
}

// PATCH /api/me → update the current resident's own preferences.
// Currently: { isSeniorCitizen: boolean }.
export async function PATCH(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.isSeniorCitizen !== "boolean") {
    return NextResponse.json({ error: "isSeniorCitizen (boolean) is required" }, { status: 400 });
  }

  await prisma.resident.update({
    where: { id: me.id },
    data: { isSeniorCitizen: body.isSeniorCitizen },
  });

  return NextResponse.json({ ok: true, isSeniorCitizen: body.isSeniorCitizen });
}
