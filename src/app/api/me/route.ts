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
    dailyStepGoal: me.dailyStepGoal,
    stepSource: me.stepSource,
    roles: me.roles,
  });
}

const VALID_STEP_SOURCES = ["apple_health", "core_motion", "health_connect"];

// PATCH /api/me → update the current resident's own preferences.
// Accepts any of: { isSeniorCitizen: boolean, dailyStepGoal: number,
// stepSource: "apple_health"|"core_motion"|"health_connect"|null }.
export async function PATCH(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isSeniorCitizen === "boolean") {
    data.isSeniorCitizen = body.isSeniorCitizen;
  }
  if (typeof body.dailyStepGoal === "number") {
    data.dailyStepGoal = Math.max(0, Math.min(200000, Math.round(body.dailyStepGoal)));
  }
  if (body.stepSource === null || VALID_STEP_SOURCES.includes(body.stepSource)) {
    data.stepSource = body.stepSource;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.resident.update({ where: { id: me.id }, data });

  return NextResponse.json({ ok: true, ...data });
}
