import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

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

// GET /api/admin/accountability-debts?residentId=&status=
// Lists debt line items (newest first) with the resident, plus per-status totals.
export async function GET(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { searchParams } = new URL(request.url);
  const residentId = searchParams.get("residentId") || undefined;
  const statusParam = searchParams.get("status") || undefined;
  const status =
    statusParam === "OWED" || statusParam === "PAID" || statusParam === "WAIVED"
      ? statusParam
      : undefined;

  const where: Prisma.AccountabilityDebtWhereInput = {};
  if (residentId) where.residentId = residentId;
  if (status) where.status = status;

  const debts = await prisma.accountabilityDebt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      resident: { select: { id: true, name: true, block: true, flatNumber: true } },
    },
  });

  const byStatus = await prisma.accountabilityDebt.groupBy({
    by: ["status"],
    where,
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totals = { OWED: 0, PAID: 0, WAIVED: 0 };
  const counts = { OWED: 0, PAID: 0, WAIVED: 0 };
  for (const g of byStatus) {
    totals[g.status] = g._sum.amount ?? 0;
    counts[g.status] = g._count._all;
  }

  return NextResponse.json({
    debts: debts.map((d) => ({
      id: d.id,
      residentId: d.residentId,
      residentName: d.resident.name,
      block: d.resident.block,
      flatNumber: d.resident.flatNumber,
      amount: d.amount,
      reason: d.reason,
      status: d.status,
      sourceType: d.sourceType,
      note: d.note,
      createdBy: d.createdBy,
      createdAt: d.createdAt,
      paidAt: d.paidAt,
    })),
    totals,
    counts,
    grandTotal: totals.OWED + totals.PAID + totals.WAIVED,
  });
}

// POST /api/admin/accountability-debts  { residentId, amount, reason, note? }
// Manually add a debt line item (no source tag — generic ledger entry).
export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const residentId = typeof body?.residentId === "string" ? body.residentId : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const amount = Math.round(Number(body?.amount));
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

  if (!residentId || !reason || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "residentId, a positive amount, and reason are required" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { id: residentId },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const debt = await prisma.accountabilityDebt.create({
    data: {
      residentId,
      amount,
      reason,
      note,
      status: "OWED",
      createdBy: check.session.user.email ?? null,
    },
  });

  return NextResponse.json({ success: true, debt });
}
