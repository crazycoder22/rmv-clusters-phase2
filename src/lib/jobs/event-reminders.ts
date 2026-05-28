import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { ymdToInstant, addDaysYmd } from "@/lib/habits";
import type { DailyJob, DailyJobContext, DailyJobResult } from "./types";

// Daily job: remind residents who RSVP'd to an event happening TOMORROW.
// Targets only the people who signed up (resident RSVPs — guests have no app
// account), so it's a useful heads-up rather than a broadcast.
export const eventReminders: DailyJob = {
  id: "event-reminders",
  description:
    "Push residents who RSVP'd to any published event happening tomorrow.",

  async run(ctx: DailyJobContext): Promise<DailyJobResult> {
    const tomorrowYmd = addDaysYmd(ctx.todayYmd, 1);
    const dayAfterYmd = addDaysYmd(ctx.todayYmd, 2);
    // [tomorrow 00:00 IST, day-after 00:00 IST) — the whole IST civil day.
    const windowStart = ymdToInstant(tomorrowYmd);
    const windowEnd = ymdToInstant(dayAfterYmd);

    // Published event announcements dated tomorrow that have an eventConfig
    // with RSVPs. Pull each event's resident RSVPs (residentId only).
    const events = await prisma.announcement.findMany({
      where: {
        published: true,
        date: { gte: windowStart, lt: windowEnd },
        eventConfig: { isNot: null },
      },
      select: {
        title: true,
        eventConfig: {
          select: {
            rsvps: { select: { residentId: true } },
          },
        },
      },
    });

    let eventsWithRsvps = 0;
    let pushesSent = 0;
    let pushFailed = 0;

    for (const ev of events) {
      const residentIds = (ev.eventConfig?.rsvps ?? []).map((r) => r.residentId);
      if (residentIds.length === 0) continue;
      eventsWithRsvps++;
      try {
        const res = await sendPushToResidents(residentIds, {
          title: "📅 Event tomorrow",
          body: `Reminder: "${ev.title}" is tomorrow. See you there!`,
          // Reuse the existing "announcement" tap route → opens News, where
          // the event lives. No mobile change needed.
          data: { type: "announcement" },
        });
        pushesSent += res.sent;
        pushFailed += res.failed;
      } catch {
        pushFailed += residentIds.length;
      }
    }

    return {
      ok: true,
      detail: `${events.length} event(s) tomorrow; reminded RSVPs for ${eventsWithRsvps}; ${pushesSent} push(es) sent, ${pushFailed} failed.`,
      metrics: {
        eventsTomorrow: events.length,
        eventsWithRsvps,
        pushesSent,
        pushFailed,
      },
    };
  },
};
