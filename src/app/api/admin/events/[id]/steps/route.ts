import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");

  // Get announcement + eventConfig with participants
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      eventConfig: {
        include: {
          customFields: { orderBy: { sortOrder: "asc" } },
          rsvps: {
            include: {
              resident: { select: { name: true, block: true, flatNumber: true } },
              fieldResponses: {
                include: { customField: { select: { id: true, label: true, fieldType: true } } },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          guestRsvps: {
            include: {
              fieldResponses: {
                include: { customField: { select: { id: true, label: true, fieldType: true } } },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const ec = announcement.eventConfig;

  // Get step entries for the date if provided
  let stepEntries: { rsvpId: string | null; guestRsvpId: string | null; steps: number }[] = [];
  if (dateStr) {
    const date = new Date(dateStr + "T00:00:00.000Z");
    stepEntries = await prisma.stepEntry.findMany({
      where: { eventConfigId: ec.id, date },
      select: { rsvpId: true, guestRsvpId: true, steps: true },
    });
  }

  // Build step lookup
  const stepMap = new Map<string, number>();
  for (const se of stepEntries) {
    if (se.rsvpId) stepMap.set(`r-${se.rsvpId}`, se.steps);
    if (se.guestRsvpId) stepMap.set(`g-${se.guestRsvpId}`, se.steps);
  }

  // Find the "goal" custom field (first select-type field)
  const goalField = ec.customFields.find((cf) => cf.fieldType === "select");

  // Map participants
  const participants = [
    ...ec.rsvps.map((r) => {
      const goalResponse = goalField
        ? r.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
        : undefined;
      return {
        rsvpId: r.id,
        guestRsvpId: null as string | null,
        isGuest: false,
        name: r.resident.name,
        block: r.resident.block,
        flatNumber: r.resident.flatNumber,
        dailyGoal: goalResponse?.value || "",
        steps: stepMap.get(`r-${r.id}`) ?? null,
      };
    }),
    ...ec.guestRsvps.map((g) => {
      const goalResponse = goalField
        ? g.fieldResponses.find((fr) => fr.customFieldId === goalField.id)
        : undefined;
      return {
        rsvpId: null as string | null,
        guestRsvpId: g.id,
        isGuest: true,
        name: g.name,
        block: g.block,
        flatNumber: g.flatNumber,
        dailyGoal: goalResponse?.value || "",
        steps: stepMap.get(`g-${g.id}`) ?? null,
      };
    }),
  ];

  return NextResponse.json({
    eventTitle: announcement.title,
    eventConfigId: ec.id,
    participants,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { date: dateStr, entries } = body as {
    date: string;
    entries: { rsvpId?: string; guestRsvpId?: string; steps: number }[];
  };

  if (!dateStr || !Array.isArray(entries)) {
    return NextResponse.json({ error: "date and entries required" }, { status: 400 });
  }

  // Verify event exists
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: { eventConfig: { select: { id: true } } },
  });
  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const eventConfigId = announcement.eventConfig.id;
  const date = new Date(dateStr + "T00:00:00.000Z");

  // Filter valid entries (steps > 0)
  const validEntries = entries.filter((e) => e.steps > 0 && (e.rsvpId || e.guestRsvpId));

  // Also find entries that should be deleted (steps = 0 but may have existing records)
  const zeroEntries = entries.filter((e) => (!e.steps || e.steps <= 0) && (e.rsvpId || e.guestRsvpId));

  await prisma.$transaction([
    // Upsert valid entries
    ...validEntries.map((entry) => {
      if (entry.rsvpId) {
        return prisma.stepEntry.upsert({
          where: { rsvpId_date: { rsvpId: entry.rsvpId, date } },
          create: {
            eventConfigId,
            rsvpId: entry.rsvpId,
            date,
            steps: entry.steps,
          },
          update: { steps: entry.steps },
        });
      } else {
        return prisma.stepEntry.upsert({
          where: { guestRsvpId_date: { guestRsvpId: entry.guestRsvpId!, date } },
          create: {
            eventConfigId,
            guestRsvpId: entry.guestRsvpId,
            date,
            steps: entry.steps,
          },
          update: { steps: entry.steps },
        });
      }
    }),
    // Delete zero entries
    ...zeroEntries.flatMap((entry) => {
      if (entry.rsvpId) {
        return [prisma.stepEntry.deleteMany({
          where: { rsvpId: entry.rsvpId, date },
        })];
      } else if (entry.guestRsvpId) {
        return [prisma.stepEntry.deleteMany({
          where: { guestRsvpId: entry.guestRsvpId, date },
        })];
      }
      return [];
    }),
  ]);

  return NextResponse.json({ saved: validEntries.length });
}
