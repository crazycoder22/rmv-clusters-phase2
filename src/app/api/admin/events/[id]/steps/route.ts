import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";
import { upsertStepEntries } from "@/lib/steps";

// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
async function requireAdmin(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageAnnouncements(resident.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { resident };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin(request);
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
  const check = await requireAdmin(request);
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

  try {
    // Admin can overwrite freely — including zero-out a value — so disable
    // the guard that protects against accidental zero-overwrites.
    const result = await upsertStepEntries(
      eventConfigId,
      entries.map((e) => ({
        date: dateStr,
        steps: e.steps,
        rsvpId: e.rsvpId,
        guestRsvpId: e.guestRsvpId,
      })),
      { guardZeroOverwrite: false }
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("Step save error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
