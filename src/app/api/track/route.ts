import { NextResponse } from "next/server";
import { getAuthedResident, platformOf } from "@/lib/api-auth";
import { cleanKey, recordPageView, recordDwell } from "@/lib/track";

export const dynamic = "force-dynamic";

// POST /api/track — record a page/feature view for the authenticated resident.
// Body: { feature, pageKey, entityId? }. Dual auth (mobile bearer + web cookie).
// Anonymous callers and non-whitelisted keys are silently no-op'd (204) so the
// client never sees a tracking error. Logged-in residents only → public/anon
// web opens are never counted.
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return new NextResponse(null, { status: 204 });

  const body = await request.json().catch(() => null);
  const feature = cleanKey(body?.feature);
  const pageKey = cleanKey(body?.pageKey);
  if (!feature || !pageKey) return new NextResponse(null, { status: 204 });

  const entityId =
    typeof body?.entityId === "string" && body.entityId.length <= 100 ? body.entityId : null;
  const platform = platformOf(request);
  const durationMs =
    typeof body?.durationMs === "number" && body.durationMs > 0 ? body.durationMs : null;

  // A ping carrying durationMs is a dwell update for an existing view; otherwise
  // it's a fresh view.
  if (durationMs) {
    recordDwell({ residentId: me.id, feature, pageKey, entityId, durationMs, platform });
  } else {
    recordPageView({ residentId: me.id, feature, pageKey, entityId, platform });
  }

  return new NextResponse(null, { status: 204 });
}
