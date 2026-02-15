import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      sportsConfig: {
        include: {
          sportItems: { orderBy: { sortOrder: "asc" } },
          registrations: {
            include: {
              resident: {
                select: { id: true, name: true, email: true, block: true, flatNumber: true },
              },
              participants: {
                include: {
                  sports: { include: { sportItem: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  if (!announcement || !announcement.sportsConfig) {
    return NextResponse.json(
      { error: "Event not found or sports registration not enabled" },
      { status: 404 }
    );
  }

  const sc = announcement.sportsConfig;

  // Compute summary stats
  const totalRegistrations = sc.registrations.length;
  const totalParticipants = sc.registrations.reduce(
    (sum, r) => sum + r.participants.length,
    0
  );

  // Per-sport counts
  const sportCounts: Record<string, { name: string; count: number }> = {};
  for (const sport of sc.sportItems) {
    sportCounts[sport.id] = { name: sport.name, count: 0 };
  }
  for (const reg of sc.registrations) {
    for (const p of reg.participants) {
      for (const ps of p.sports) {
        if (sportCounts[ps.sportItemId]) {
          sportCounts[ps.sportItemId].count++;
        }
      }
    }
  }

  // Per age category counts
  const ageCounts = { kid: 0, teen: 0, adult: 0 };
  for (const reg of sc.registrations) {
    for (const p of reg.participants) {
      if (p.ageCategory in ageCounts) {
        ageCounts[p.ageCategory as keyof typeof ageCounts]++;
      }
    }
  }

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      date: announcement.date,
    },
    sportsConfig: sc,
    summary: {
      totalRegistrations,
      totalParticipants,
      sportCounts: Object.values(sportCounts),
      ageCounts,
    },
  });
}
