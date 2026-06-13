import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { canManageAnnouncements } from "@/lib/roles";
import { sendPushToResidents } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/admin/push/broadcast
//
// Fires a single push notification to every signed-in device belonging to
// an approved resident. Multiplexes iOS (APNs) + Android (FCM) via the
// existing sendPushToResidents().
//
// Used by the admin /admin/push-nudge page when we want to broadcast an
// "update your app" or similar one-shot message that doesn't belong on
// the announcements feed.
//
// Body: { title: string, body: string, data?: Record<string, string> }
export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(resident.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const messageBody = String(body.body ?? "").trim();
  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "Title is required (≤ 200 chars)." },
      { status: 400 }
    );
  }
  if (!messageBody || messageBody.length > 500) {
    return NextResponse.json(
      { error: "Body is required (≤ 500 chars)." },
      { status: 400 }
    );
  }

  const data: Record<string, string> = {};
  if (body.data && typeof body.data === "object") {
    for (const [k, v] of Object.entries(body.data)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        data[k] = String(v);
      }
    }
  }
  // Default type tag so the mobile push handler doesn't try to deep-link
  // anywhere. Taps just open the home page — fine for a nudge.
  if (!data.type) data.type = "broadcast";

  const res = await sendPushToResidents(null, {
    title,
    body: messageBody,
    data,
  });

  return NextResponse.json({
    ok: true,
    sent: res.sent,
    failed: res.failed,
    pruned: res.invalidTokens.length,
  });
}

// GET /api/admin/push/broadcast — counts only, so the admin UI can show
// "Targeting N devices" before they click Send.
export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageAnnouncements(resident.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [iosTokens, androidTokens, approvedResidents] = await Promise.all([
    prisma.deviceToken.count({
      where: { platform: "ios", resident: { isApproved: true } },
    }),
    prisma.deviceToken.count({
      where: { platform: "android", resident: { isApproved: true } },
    }),
    prisma.resident.count({ where: { isApproved: true } }),
  ]);

  return NextResponse.json({
    iosTokens,
    androidTokens,
    totalTokens: iosTokens + androidTokens,
    approvedResidents,
  });
}
