import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { parseGoal } from "@/lib/steps";

export const dynamic = "force-dynamic";

// Step challenges run for 14 days starting from announcement.date — same
// constant the existing dashboard route uses for its "on track" logic.
const CHALLENGE_DAYS = 14;
// We surface events that are active OR ended <=3 days ago, so participants
// can still see final standings without the card disappearing the moment
// the clock strikes midnight on day 14.
const TAIL_DAYS = 3;

// GET /api/me/step-events
//
// Returns every EventConfig with `stepTrackingEnabled = true` that the
// caller has an Rsvp for, scoped to events currently inside the 14-day
// challenge window (or finished in the last few days). The mobile app uses
// this on launch to decide whether to show the Stepup hero card and which
// event to deep-link to.
//
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rsvps = await prisma.rsvp.findMany({
    where: {
      residentId: me.id,
      eventConfig: { stepTrackingEnabled: true },
    },
    include: {
      eventConfig: {
        include: {
          announcement: {
            select: { id: true, title: true, date: true, summary: true, emoji: true },
          },
          customFields: { orderBy: { sortOrder: "asc" } },
        },
      },
      fieldResponses: true,
    },
  });

  const now = Date.now();
  const events = rsvps
    .map((r) => {
      const ann = r.eventConfig.announcement;
      const start = new Date(ann.date);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + CHALLENGE_DAYS);

      // Pick the first select-type custom field as the goal field — matches
      // dashboard convention.
      const goalField = r.eventConfig.customFields.find(
        (cf) => cf.fieldType === "select"
      );
      const goalResponse = goalField
        ? r.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
        : undefined;
      const dailyGoalString = goalResponse?.value ?? "";
      const dailyGoal = parseGoal(dailyGoalString);

      return {
        rsvpId: r.id,
        eventConfigId: r.eventConfig.id,
        announcementId: ann.id,
        title: ann.title,
        summary: ann.summary,
        emoji: ann.emoji,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        dailyGoalString,
        dailyGoal,
        rsvpCreatedAt: r.createdAt.toISOString(),
      };
    })
    // Filter to active + recent-finished events.
    .filter((e) => {
      const endMs = new Date(e.endDate).getTime();
      return endMs + TAIL_DAYS * 24 * 60 * 60 * 1000 >= now;
    })
    // Earliest end-date first so the most-urgent event is on top.
    .sort(
      (a, b) =>
        new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );

  return NextResponse.json({ events });
}
