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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { entries } = body as {
    entries: { rsvpId?: string; guestRsvpId?: string; date: string; steps: number }[];
  };

  if (!Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "entries array required" }, { status: 400 });
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

  // Split into valid (steps > 0) and zero entries
  const validEntries = entries.filter((e) => e.steps > 0 && (e.rsvpId || e.guestRsvpId));
  const zeroEntries = entries.filter((e) => (!e.steps || e.steps <= 0) && (e.rsvpId || e.guestRsvpId));

  const BATCH_SIZE = 10;
  const dates = new Set<string>();

  try {
    // Upsert valid entries in batches
    for (let i = 0; i < validEntries.length; i += BATCH_SIZE) {
      const batch = validEntries.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((entry) => {
          const date = new Date(entry.date + "T00:00:00.000Z");
          dates.add(entry.date);
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
        })
      );
    }

    // Delete zero entries grouped by date
    if (zeroEntries.length > 0) {
      const byDate = new Map<string, typeof zeroEntries>();
      for (const e of zeroEntries) {
        const existing = byDate.get(e.date) || [];
        existing.push(e);
        byDate.set(e.date, existing);
      }

      for (const [dateStr, dateEntries] of byDate) {
        const date = new Date(dateStr + "T00:00:00.000Z");
        const rsvpIds = dateEntries.filter((e) => e.rsvpId).map((e) => e.rsvpId!);
        const guestIds = dateEntries.filter((e) => e.guestRsvpId).map((e) => e.guestRsvpId!);

        await prisma.$transaction([
          ...(rsvpIds.length > 0
            ? [prisma.stepEntry.deleteMany({ where: { rsvpId: { in: rsvpIds }, date } })]
            : []),
          ...(guestIds.length > 0
            ? [prisma.stepEntry.deleteMany({ where: { guestRsvpId: { in: guestIds }, date } })]
            : []),
        ]);
      }
    }
  } catch (err) {
    console.error("Bulk step save error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ saved: validEntries.length, dates: dates.size });
}
