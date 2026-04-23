import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const now = new Date();

  const rsvps = await prisma.rsvp.findMany({
    where: {
      residentId: resident.id,
      eventConfig: {
        announcement: { date: { gte: now } },
      },
    },
    include: {
      eventConfig: {
        include: {
          announcement: { select: { id: true, title: true, date: true } },
        },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const sportsRegs = await prisma.sportsRegistration.findMany({
    where: {
      residentId: resident.id,
      sportsConfig: {
        announcement: { date: { gte: now } },
      },
    },
    include: {
      sportsConfig: {
        include: {
          announcement: { select: { id: true, title: true, date: true } },
        },
      },
      participants: {
        include: { sports: { include: { sportItem: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rsvpData = rsvps.map((r) => ({
    id: r.id,
    announcementId: r.eventConfig.announcement.id,
    eventTitle: r.eventConfig.announcement.title,
    eventDate: r.eventConfig.announcement.date,
    mealType: r.eventConfig.mealType,
    totalPlates: r.items.reduce((sum, item) => sum + item.plates, 0),
    paid: r.paid,
  }));

  const sportsData = sportsRegs.map((sr) => {
    const allSports = new Set<string>();
    for (const p of sr.participants) {
      for (const ps of p.sports) {
        allSports.add(ps.sportItem.name);
      }
    }
    return {
      id: sr.id,
      announcementId: sr.sportsConfig.announcement.id,
      eventTitle: sr.sportsConfig.announcement.title,
      eventDate: sr.sportsConfig.announcement.date,
      participantCount: sr.participants.length,
      sports: Array.from(allSports),
    };
  });

  return NextResponse.json({
    rsvps: rsvpData,
    sportsRegistrations: sportsData,
  });
}
