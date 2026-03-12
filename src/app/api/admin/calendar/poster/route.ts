import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getEffectiveEmoji } from "@/lib/emoji";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session };
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function GET(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const [calendarEvents, announcements] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { date: { gte: startOfYear, lt: endOfYear } },
      orderBy: { date: "asc" },
    }),
    prisma.announcement.findMany({
      where: {
        published: true,
        category: { in: ["event", "sports"] },
        date: { gte: startOfYear, lt: endOfYear },
      },
      select: { id: true, title: true, date: true, emoji: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Build unified list, deduplicating by title+month
  const seen = new Set<string>();

  interface PosterEvent {
    id: string;
    title: string;
    date: string;
    emoji: string;
    source: "calendar" | "announcement";
  }

  const allEvents: PosterEvent[] = [];

  for (const ce of calendarEvents) {
    const month = new Date(ce.date).getMonth();
    const key = `${ce.title.toLowerCase().trim()}-${month}`;
    if (!seen.has(key)) {
      seen.add(key);
      allEvents.push({
        id: ce.id,
        title: ce.title,
        date: ce.date.toISOString(),
        emoji: getEffectiveEmoji(ce.title, ce.emoji),
        source: "calendar",
      });
    }
  }

  for (const a of announcements) {
    const month = new Date(a.date).getMonth();
    const key = `${a.title.toLowerCase().trim()}-${month}`;
    if (!seen.has(key)) {
      seen.add(key);
      allEvents.push({
        id: a.id,
        title: a.title,
        date: a.date.toISOString(),
        emoji: getEffectiveEmoji(a.title, a.emoji),
        source: "announcement",
      });
    }
  }

  // Group by month, only include months with events
  interface PosterMonth {
    month: number;
    name: string;
    events: PosterEvent[];
  }

  const months: PosterMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const monthEvents = allEvents
      .filter((e) => new Date(e.date).getMonth() === m)
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    if (monthEvents.length > 0) {
      months.push({ month: m, name: MONTH_NAMES[m], events: monthEvents });
    }
  }

  return NextResponse.json({ year, months });
}
