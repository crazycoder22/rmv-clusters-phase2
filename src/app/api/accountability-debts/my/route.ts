import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/accountability-debts/my
//
// Returns the signed-in resident's own Accountability Debt line items plus
// totals. Strictly scoped to the caller (residentId === me.id); admin notes are
// not exposed.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.accountabilityDebt.findMany({
    where: { residentId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      reason: true,
      status: true,
      createdAt: true,
      paidAt: true,
    },
  });

  const sumWhere = (s: "OWED" | "PAID" | "WAIVED") =>
    rows.filter((d) => d.status === s).reduce((acc, d) => acc + d.amount, 0);

  return NextResponse.json({
    debts: rows,
    totalOwed: sumWhere("OWED"),
    totalPaid: sumWhere("PAID"),
    totalWaived: sumWhere("WAIVED"),
    count: rows.length,
  });
}
