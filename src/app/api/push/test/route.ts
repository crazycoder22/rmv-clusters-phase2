import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/push/test — sends a test notification to ALL devices
// registered to the caller's resident account. SUPERADMIN-only so we don't
// turn this into a way for anyone to spam themselves accidentally.
//
// Optional body: { title?, body? } — sensible defaults if missing.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title : "🔔 Test push";
  const message =
    typeof body?.body === "string"
      ? body.body
      : "If you see this, push notifications work.";

  const tokens = await prisma.deviceToken.findMany({
    where: { residentId: me.id },
    select: { token: true },
  });

  if (tokens.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No devices registered for your account yet.",
        hint:
          "Open the mobile app, grant notification permission, and try again.",
      },
      { status: 400 }
    );
  }

  const result = await sendPush(
    tokens.map((t) => t.token),
    { title, body: message, data: { type: "test" } }
  );

  return NextResponse.json({
    ok: true,
    devicesAttempted: tokens.length,
    ...result,
  });
}
