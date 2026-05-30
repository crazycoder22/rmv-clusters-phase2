import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { canAccessTasks } from "@/lib/roles";
import { istTodayYmd } from "@/lib/dates-ist";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/admin/duty-checklists/status?date=YYYY-MM-DD (default today)
// Oversight board: each active checklist with every item's done/missed state
// for that IST day, plus who ticked it and the owners responsible.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTasks(me.roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const param = new URL(request.url).searchParams.get("date");
  const date = param && YMD.test(param) ? param : istTodayYmd();

  const checklists = await prisma.dutyChecklist.findMany({
    where: { active: true },
    orderBy: [{ reminderWave: "asc" }, { title: "asc" }],
    include: {
      owners: { include: { resident: { select: { name: true } } } },
      items: {
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          completions: {
            where: { date },
            include: { resident: { select: { name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({
    date,
    checklists: checklists.map((cl) => {
      const items = cl.items.map((it) => {
        const done = it.completions[0];
        return {
          id: it.id,
          title: it.title,
          done: !!done,
          doneBy: done?.resident.name ?? null,
          doneAt: done?.createdAt.toISOString() ?? null,
        };
      });
      return {
        id: cl.id,
        title: cl.title,
        reminderWave: cl.reminderWave,
        owners: cl.owners.map((o) => o.resident.name),
        items,
        doneCount: items.filter((i) => i.done).length,
        totalCount: items.length,
      };
    }),
  });
}
