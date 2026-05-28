import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { ymdToInstant } from "@/lib/habits";
import type { DailyJob, DailyJobContext, DailyJobResult } from "./types";

// Daily job: remind owners who still have an active habit unmarked for today.
// One summary push per resident (not one per habit) to keep it quiet.
export const habitReminders: DailyJob = {
  id: "habit-reminders",
  description:
    "Push a summary reminder to residents with active habits not yet marked done today.",

  async run(ctx: DailyJobContext): Promise<DailyJobResult> {
    const todayInstant = ymdToInstant(ctx.todayYmd);

    // Active habits whose window includes today, with a flag for whether
    // today is already checked off (filtered include = today's checkin only).
    const habits = await prisma.habit.findMany({
      where: {
        active: true,
        startDate: { lte: todayInstant },
        endDate: { gte: todayInstant },
      },
      select: {
        title: true,
        ownerId: true,
        checkins: { where: { date: todayInstant }, select: { id: true } },
      },
    });

    // Group the unmarked ones by owner.
    const pendingByOwner = new Map<string, string[]>();
    for (const h of habits) {
      if (h.checkins.length > 0) continue; // already done today
      const list = pendingByOwner.get(h.ownerId) ?? [];
      list.push(h.title);
      pendingByOwner.set(h.ownerId, list);
    }

    let notified = 0;
    let pushFailed = 0;
    for (const [ownerId, titles] of pendingByOwner) {
      const body =
        titles.length === 1
          ? `Don't forget: ${titles[0]}`
          : `${titles.length} habits to mark today — ${titles.join(", ")}`;
      try {
        const res = await sendPushToResidents([ownerId], {
          title: "🎯 Habit reminder",
          body,
          // "habit" prefix → mobile routes the tap to the Habits list.
          data: { type: "habit_reminder" },
        });
        if (res.sent > 0) notified++;
        else pushFailed++;
      } catch {
        pushFailed++;
      }
    }

    const totalPending = [...pendingByOwner.values()].reduce(
      (s, t) => s + t.length,
      0
    );

    return {
      ok: true,
      detail: `Reminded ${notified} resident(s) about ${totalPending} unmarked habit(s); ${pushFailed} push failure(s).`,
      metrics: {
        residentsWithPending: pendingByOwner.size,
        residentsNotified: notified,
        habitsPending: totalPending,
        pushFailed,
      },
    };
  },
};
