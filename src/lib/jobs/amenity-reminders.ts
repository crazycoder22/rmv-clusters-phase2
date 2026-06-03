import { prisma } from "@/lib/prisma";
import { sendPushToResidents } from "@/lib/push";
import { ymdToInstant, addDaysYmd } from "@/lib/habits";
import type { DailyJob, DailyJobContext, DailyJobResult } from "./types";

// Daily job: remind residents who have a CONFIRMED amenity booking that starts
// TOMORROW (IST). One push per booking, deep-linking to the booking detail.
export const amenityReminders: DailyJob = {
  id: "amenity-reminders",
  description: "Push residents with a confirmed amenity booking starting tomorrow.",

  async run(ctx: DailyJobContext): Promise<DailyJobResult> {
    const tomorrowYmd = addDaysYmd(ctx.todayYmd, 1);
    const dayAfterYmd = addDaysYmd(ctx.todayYmd, 2);
    const windowStart = ymdToInstant(tomorrowYmd);
    const windowEnd = ymdToInstant(dayAfterYmd);

    const bookings = await prisma.amenityBooking.findMany({
      where: {
        status: "CONFIRMED",
        startAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        id: true,
        bookerId: true,
        startAt: true,
        amenity: { select: { name: true } },
      },
    });

    let pushesSent = 0;
    let pushFailed = 0;

    for (const b of bookings) {
      const time = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      }).format(b.startAt);
      try {
        const res = await sendPushToResidents([b.bookerId], {
          title: "📅 Booking tomorrow",
          body: `Your ${b.amenity.name} booking is tomorrow at ${time}.`,
          data: { type: "amenity_booking", id: b.id },
        });
        pushesSent += res.sent;
        pushFailed += res.failed;
      } catch {
        pushFailed += 1;
      }
    }

    return {
      ok: true,
      detail: `${bookings.length} confirmed booking(s) tomorrow; ${pushesSent} push(es) sent, ${pushFailed} failed.`,
      metrics: { bookingsTomorrow: bookings.length, pushesSent, pushFailed },
    };
  },
};
