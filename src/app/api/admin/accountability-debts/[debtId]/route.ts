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

// PATCH /api/admin/accountability-debts/[debtId]  { status?, note? }
// Settle a debt: set status OWED|PAID|WAIVED (PAID stamps paidAt; others clear
// it) and/or update the admin note. Mirrors the rsvp togglePaid PATCH pattern.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ debtId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { debtId } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  const data: {
    status?: "OWED" | "PAID" | "WAIVED";
    paidAt?: Date | null;
    note?: string | null;
  } = {};

  if (body?.status !== undefined) {
    if (body.status !== "OWED" && body.status !== "PAID" && body.status !== "WAIVED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.paidAt = body.status === "PAID" ? new Date() : null;
  }
  if (body?.note !== undefined) {
    data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const debt = await prisma.accountabilityDebt.update({ where: { id: debtId }, data });
    return NextResponse.json({ success: true, debt });
  } catch {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }
}

// DELETE /api/admin/accountability-debts/[debtId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ debtId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { debtId } = await params;
  try {
    await prisma.accountabilityDebt.delete({ where: { id: debtId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }
}
