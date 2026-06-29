import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { assessStepCompletion, type ParticipantAssessment } from "@/lib/steps";

const SOURCE_TYPE = "stepup_event";
const DEFAULT_AMOUNT = 300;

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

function summarize(p: ParticipantAssessment) {
  return {
    residentId: p.residentId,
    name: p.name,
    dailyGoal: p.dailyGoal,
    daysGoalMet: p.daysGoalMet,
    totalSteps: p.totalSteps,
  };
}

// POST /api/admin/events/[id]/accountability-debts/generate
//
// Assess step-challenge completion and (optionally) create ₹300 Accountability
// Debt line items for participants who registered + walked but missed their goal
// (hasData && goal set && daysGoalMet < 12). Registrants with zero step data are
// reported under skippedNoData and never charged. Idempotent: re-running never
// duplicates and never downgrades an already-settled (PAID/WAIVED) row.
//
// Body: { dryRun?: boolean, amount?: number }  (amount defaults to 300)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const dryRun = body?.dryRun === true;
  const rawAmount = Number(body?.amount);
  const amount =
    Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount) : DEFAULT_AMOUNT;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { title: true, eventConfig: { select: { id: true } } },
  });
  if (!announcement?.eventConfig) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const eventConfigId = announcement.eventConfig.id;
  const reason = `${announcement.title} — goal not completed`;

  const assessed = await assessStepCompletion(id);
  const wouldCharge = assessed.filter((p) => p.hasData && p.dailyGoal > 0 && !p.completed);
  const skippedNoData = assessed.filter((p) => p.dailyGoal > 0 && !p.hasData);
  const completed = assessed.filter((p) => p.completed);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      amount,
      reason,
      eventConfigId,
      wouldCharge: wouldCharge.map(summarize),
      skippedNoData: skippedNoData.map(summarize),
      completed: completed.map(summarize),
      totals: {
        chargeCount: wouldCharge.length,
        chargeAmount: wouldCharge.length * amount,
        skippedNoData: skippedNoData.length,
        completed: completed.length,
      },
    });
  }

  // Commit: only create rows that don't already exist for this (source, resident).
  // Existing rows — including ones already marked PAID/WAIVED — are left untouched.
  const existingRows = await prisma.accountabilityDebt.findMany({
    where: { sourceType: SOURCE_TYPE, sourceId: eventConfigId },
    select: { residentId: true },
  });
  const existingIds = new Set(existingRows.map((r) => r.residentId));
  const toCreate = wouldCharge.filter((p) => !existingIds.has(p.residentId));

  if (toCreate.length > 0) {
    await prisma.accountabilityDebt.createMany({
      data: toCreate.map((p) => ({
        residentId: p.residentId,
        amount,
        reason,
        status: "OWED" as const,
        sourceType: SOURCE_TYPE,
        sourceId: eventConfigId,
        createdBy: check.session.user.email ?? null,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    dryRun: false,
    amount,
    reason,
    eventConfigId,
    created: toCreate.length,
    alreadyExisted: wouldCharge.length - toCreate.length,
    charged: wouldCharge.map(summarize),
    skippedNoData: skippedNoData.map(summarize),
    totals: {
      chargeCount: wouldCharge.length,
      chargeAmount: wouldCharge.length * amount,
    },
  });
}
