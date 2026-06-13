import { NextResponse } from "next/server";
import { getAuthedResident, platformOf } from "@/lib/api-auth";
import { isTrackable, recordPageView } from "@/lib/track";

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
  const feature = body?.feature;
  const pageKey = body?.pageKey;
  if (!isTrackable(feature, pageKey)) return new NextResponse(null, { status: 204 });

  recordPageView({
    residentId: me.id,
    feature,
    pageKey,
    entityId: typeof body?.entityId === "string" ? body.entityId : null,
    platform: platformOf(request),
  });

  return new NextResponse(null, { status: 204 });
}
