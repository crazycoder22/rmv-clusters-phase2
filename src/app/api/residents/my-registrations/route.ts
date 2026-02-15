import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireResident() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!session.user.isRegistered) {
    return { error: NextResponse.json({ error: "Not registered" }, { status: 403 }) };
  }
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (!resident) {
    return { error: NextResponse.json({ error: "Resident not found" }, { status: 404 }) };
  }
  return { session, resident };
}

export async function GET() {
  const check = await requireResident();
  if ("error" in check && check.error) return check.error;

  const { resident } = check;
  const now = new Date();

  const rsvps = await prisma.rsvp.findMany({
    where: {
      residentId: resident!.id,
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
      items: { include: { menuItem: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const sportsRegs = await prisma.sportsRegistration.findMany({
    where: {
      residentId: resident!.id,
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

  // Shape the response
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
