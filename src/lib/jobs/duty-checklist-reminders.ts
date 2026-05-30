import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import type { DailyJob, DailyJobContext, DailyJobResult } from "./types";

/**
 * Reminds duty-checklist owners of items they haven't ticked off today.
 *
 * Runs on BOTH waves: for the current wave it looks at checklists whose
 * reminderWave matches, finds active items with no completion row for today
 * (IST), and pushes each owner once with the total pending across their
 * checklists. (Morning cron → MORNING checklists; evening cron → EVENING.)
 */
export const dutyChecklistReminders: DailyJob = {
  id: "duty-checklist-reminders",
  description: "Remind staff of duty-checklist items not yet done today.",
  waves: ["MORNING", "EVENING"],

  async run(ctx: DailyJobContext): Promise<DailyJobResult> {
    const { todayYmd, wave } = ctx;

    const checklists = await prisma.dutyChecklist.findMany({
      where: { active: true, reminderWave: wave },
      include: {
        owners: { select: { residentId: true } },
        items: {
          where: { active: true, completions: { none: { date: todayYmd } } },
          select: { id: true },
        },
      },
    });

    // Aggregate pending item count per owner across all their checklists.
    const pendingByOwner = new Map<string, number>();
    for (const cl of checklists) {
      const pending = cl.items.length;
      if (pending === 0) continue;
      for (const o of cl.owners) {
        pendingByOwner.set(o.residentId, (pendingByOwner.get(o.residentId) ?? 0) + pending);
      }
    }

    let notified = 0;
    let pushFailed = 0;
    for (const [ownerId, count] of pendingByOwner) {
      try {
        const res = await sendPushToResidents([ownerId], {
          title: "🛎️ Duty reminder",
          body: `You have ${count} dut${count === 1 ? "y" : "ies"} still pending today.`,
          data: { type: "duty" },
        });
        if (res.sent > 0) notified++;
        else pushFailed++;
      } catch {
        pushFailed++;
      }
    }

    const totalPending = [...pendingByOwner.values()].reduce((s, n) => s + n, 0);
    return {
      ok: true,
      detail: `${wave}: reminded ${notified} owner(s) about ${totalPending} pending dut(y/ies); ${pushFailed} push failure(s).`,
      metrics: {
        checklistsScanned: checklists.length,
        ownersWithPending: pendingByOwner.size,
        ownersNotified: notified,
        pushFailed,
      },
    };
  },
};
