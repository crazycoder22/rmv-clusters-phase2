import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { upsertStepEntries, type StepUpsertEntry } from "@/lib/steps";

export const dynamic = "force-dynamic";

// POST /api/events/[id]/my-steps
//
// Resident self-report endpoint. Accepts an array of daily step counts so a
// single HealthKit sync can submit the whole event window in one call. The
// route is strictly scoped to the caller's own RSVP — `guestRsvpId` is
// ignored even if passed. Guests still flow through the existing admin
// upload path.
//
// Body shape:
//   { entries: [{ date: "YYYY-MM-DD", steps: number }, …] }
//
// Auth: NextAuth cookie (web) or mobile JWT.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: announcementId } = await params;

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries array required" },
      { status: 400 }
    );
  }

  // Look up the announcement → eventConfig → caller's RSVP.
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    include: {
      eventConfig: {
        select: { id: true, stepTrackingEnabled: true },
      },
    },
  });
  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!announcement.eventConfig.stepTrackingEnabled) {
    return NextResponse.json(
      { error: "Step tracking is not enabled for this event" },
      { status: 400 }
    );
  }

  const rsvp = await prisma.rsvp.findUnique({
    where: {
      eventConfigId_residentId: {
        eventConfigId: announcement.eventConfig.id,
        residentId: me.id,
      },
    },
    select: { id: true },
  });
  if (!rsvp) {
    return NextResponse.json(
      { error: "You haven't registered for this event" },
      { status: 403 }
    );
  }

  // Normalise the input: drop anything missing a date or with non-numeric
  // steps; force-pin rsvpId to the caller's RSVP so a malicious client
  // can't write to someone else's record even if they guess an ID.
  const entries: StepUpsertEntry[] = [];
  for (const raw of body.entries as Array<{
    date?: string;
    steps?: unknown;
  }>) {
    if (!raw?.date || typeof raw.date !== "string") continue;
    const steps = Number(raw.steps);
    if (!Number.isFinite(steps)) continue;
    // Reject obviously bogus values to keep the leaderboard sane.
    if (steps < 0 || steps > 500_000) continue;
    entries.push({
      date: raw.date,
      steps: Math.round(steps),
      rsvpId: rsvp.id,
    });
  }

  if (entries.length === 0) {
    return NextResponse.json({ saved: 0, skipped: 0, deleted: 0 });
  }

  try {
    const result = await upsertStepEntries(
      announcement.eventConfig.id,
      entries,
      { scope: { rsvpId: rsvp.id } }
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/events/[id]/my-steps upsert failed:", err);
    return NextResponse.json(
      { error: "Could not save step entries" },
      { status: 500 }
    );
  }
}
