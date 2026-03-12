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

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const months = await prisma.expenseMonth.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ months });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { month, year, notes, cloneFromId } = body;

  if (!month || !year || month < 1 || month > 12) {
    return NextResponse.json(
      { error: "Valid month and year are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.expenseMonth.findUnique({
    where: { month_year: { month, year } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This month already exists" },
      { status: 400 }
    );
  }

  // Create the new month
  const expenseMonth = await prisma.expenseMonth.create({
    data: { month, year, notes: notes?.trim() || null },
  });

  // Clone items from source month if requested
  if (cloneFromId) {
    const sourceItems = await prisma.expenseItem.findMany({
      where: { expenseMonthId: cloneFromId },
      orderBy: { sortOrder: "asc" },
    });

    if (sourceItems.length > 0) {
      await prisma.expenseItem.createMany({
        data: sourceItems.map((item) => ({
          expenseMonthId: expenseMonth.id,
          description: item.description,
          totalAmount: item.totalAmount,
          distributionType: item.distributionType,
          targetBlock: item.targetBlock,
          block1Amount: item.block1Amount,
          block2Amount: item.block2Amount,
          block3Amount: item.block3Amount,
          block4Amount: item.block4Amount,
          sortOrder: item.sortOrder,
        })),
      });
    }
  }

  return NextResponse.json({ expenseMonth }, { status: 201 });
}
