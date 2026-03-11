import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  // Fetch standalone calendar events
  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      date: { gte: startOfYear, lt: endOfYear },
    },
    orderBy: { date: "asc" },
  });

  // Fetch published announcements with dates in this year
  const announcements = await prisma.announcement.findMany({
    where: {
      published: true,
      date: { gte: startOfYear, lt: endOfYear },
    },
    select: {
      id: true,
      title: true,
      date: true,
      category: true,
    },
    orderBy: { date: "asc" },
  });

  // Map to unified format
  const categoryColors: Record<string, string> = {
    event: "#22c55e",     // green
    maintenance: "#f59e0b", // amber
    urgent: "#ef4444",    // red
    general: "#3b82f6",   // blue
  };

  const events = [
    ...calendarEvents.map((ce) => ({
      id: ce.id,
      title: ce.title,
      date: ce.date,
      color: ce.color,
      source: "calendar" as const,
    })),
    ...announcements.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      color: categoryColors[a.category] || "#3b82f6",
      source: "announcement" as const,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ events, year });
}
