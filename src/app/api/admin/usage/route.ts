import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET /api/admin/usage — who's using the website vs iOS vs Android app.
// Built from Resident.lastSeenAt + lastPlatform (stamped on authed API calls).
// Admin only. Dual auth (works from the web admin + the mobile admin app).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(me.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const residents = await prisma.resident.findMany({
    where: { isApproved: true },
    select: { id: true, name: true, block: true, flatNumber: true, lastSeenAt: true, lastPlatform: true },
  });

  const now = Date.now();
  const DAY = 86_400_000;
  const within = (d: Date | null, days: number) =>
    !!d && now - new Date(d).getTime() <= days * DAY;

  const active = { d1: 0, d7: 0, d30: 0 };
  // Distinct residents active in last 30d, grouped by their most recent platform.
  const byPlatform: Record<string, number> = { web: 0, ios: 0, android: 0, app: 0 };
  let neverSeen = 0;

  for (const r of residents) {
    if (!r.lastSeenAt) {
      neverSeen += 1;
      continue;
    }
    if (within(r.lastSeenAt, 1)) active.d1 += 1;
    if (within(r.lastSeenAt, 7)) active.d7 += 1;
    if (within(r.lastSeenAt, 30)) {
      active.d30 += 1;
      const p = r.lastPlatform && p_in(r.lastPlatform) ? r.lastPlatform : "app";
      byPlatform[p] = (byPlatform[p] ?? 0) + 1;
    }
  }

  // Most-recently-active residents (for the detail table).
  const recent = residents
    .filter((r) => r.lastSeenAt)
    .sort((a, b) => new Date(b.lastSeenAt!).getTime() - new Date(a.lastSeenAt!).getTime())
    .slice(0, 100)
    .map((r) => ({
      name: r.name,
      block: r.block,
      flatNumber: r.flatNumber,
      platform: r.lastPlatform ?? "app",
      lastSeenAt: r.lastSeenAt,
    }));

  return NextResponse.json({
    totalApproved: residents.length,
    neverSeen,
    everSeen: residents.length - neverSeen,
    active,
    byPlatform,
    recent,
  });
}

function p_in(p: string): boolean {
  return p === "web" || p === "ios" || p === "android" || p === "app";
}
