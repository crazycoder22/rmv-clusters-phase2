import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageNewsletters } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageNewsletters(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { startDate, endDate } = body;

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Fetch calendar events in the date range
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

  // Fetch published event announcements in the date range
  const eventAnnouncements = await prisma.announcement.findMany({
    where: {
      published: true,
      category: "event",
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

  // Build HTML content
  const items: string[] = [];

  for (const ev of calendarEvents) {
    const dateStr = ev.date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
    const emoji = ev.emoji || "";
    items.push(
      `<li><strong>${dateStr}</strong> — ${emoji} ${ev.title}</li>`
    );
  }

  for (const ann of eventAnnouncements) {
    // Skip if already covered by calendar events (same title and date)
    const annDate = ann.date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
    const alreadyCovered = calendarEvents.some(
      (ce) =>
        ce.title === ann.title &&
        ce.date.toDateString() === ann.date.toDateString()
    );
    if (!alreadyCovered) {
      items.push(
        `<li><strong>${annDate}</strong> — ${ann.emoji || ""} ${ann.title}</li>`
      );
    }
  }

  const contentHtml =
    items.length > 0
      ? `<h3>Upcoming Events</h3><ul>${items.join("")}</ul>`
      : "<p>No events found in the selected date range.</p>";

  // Get next sort order
  const maxSort = await prisma.newsletterSection.aggregate({
    where: { newsletterId: id },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  // Create the events section
  const section = await prisma.newsletterSection.create({
    data: {
      newsletterId: id,
      type: "events",
      title: "Upcoming Events",
      contentHtml,
      sortOrder: nextSortOrder,
    },
  });

  return NextResponse.json({
    section,
    eventsCount: calendarEvents.length + eventAnnouncements.length,
  }, { status: 201 });
}
