import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";
import { AUTO_APPROVE_REGISTRATIONS, getBoolSetting, setBoolSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(me.roles)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { me };
}

// GET /api/admin/settings → current global flags (admin only).
export async function GET(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check) return check.error;

  return NextResponse.json({
    autoApproveRegistrations: await getBoolSetting(AUTO_APPROVE_REGISTRATIONS),
  });
}

// PATCH /api/admin/settings → update a flag (admin only).
export async function PATCH(request: Request) {
  const check = await requireAdmin(request);
  if ("error" in check) return check.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.autoApproveRegistrations === "boolean") {
    await setBoolSetting(AUTO_APPROVE_REGISTRATIONS, body.autoApproveRegistrations);
  }

  return NextResponse.json({
    autoApproveRegistrations: await getBoolSetting(AUTO_APPROVE_REGISTRATIONS),
  });
}
