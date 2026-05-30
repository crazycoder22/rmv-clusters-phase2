import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { istTodayYmd } from "@/lib/dates-ist";

export const dynamic = "force-dynamic";

// GET /api/duties — the staff view: checklists the logged-in resident owns,
// with each active item's done-today state (and who ticked it).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = istTodayYmd();

  const checklists = await prisma.dutyChecklist.findMany({
    where: { active: true, owners: { some: { residentId: me.id } } },
    orderBy: [{ reminderWave: "asc" }, { title: "asc" }],
    include: {
      items: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          completions: {
            where: { date: today },
            include: { resident: { select: { name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({
    today,
    checklists: checklists.map((cl) => {
      const items = cl.items.map((it) => {
        const done = it.completions[0];
        return {
          id: it.id,
          title: it.title,
          doneToday: !!done,
          doneBy: done?.resident.name ?? null,
          doneAt: done?.createdAt.toISOString() ?? null,
        };
      });
      return {
        id: cl.id,
        title: cl.title,
        description: cl.description,
        reminderWave: cl.reminderWave,
        items,
        doneCount: items.filter((i) => i.doneToday).length,
        totalCount: items.length,
      };
    }),
  });
}
