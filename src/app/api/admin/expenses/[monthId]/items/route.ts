import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { calculateBlockAmounts, type DistributionType } from "@/lib/expenses";

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
  { params }: { params: Promise<{ monthId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { monthId } = await params;
  const body = await request.json();
  const { description, totalAmount, distributionType, targetBlock, customAmounts } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (totalAmount === undefined || totalAmount === null) {
    return NextResponse.json({ error: "Total amount is required" }, { status: 400 });
  }

  const validTypes: DistributionType[] = ["percentage", "block_specific", "custom", "income"];
  if (!validTypes.includes(distributionType)) {
    return NextResponse.json({ error: "Invalid distribution type" }, { status: 400 });
  }

  if (distributionType === "block_specific" && (!targetBlock || targetBlock < 1 || targetBlock > 4)) {
    return NextResponse.json(
      { error: "Valid target block (1-4) is required" },
      { status: 400 }
    );
  }

  const amounts = calculateBlockAmounts(
    totalAmount,
    distributionType as DistributionType,
    targetBlock,
    customAmounts
  );

  const maxSort = await prisma.expenseItem.aggregate({
    where: { expenseMonthId: monthId },
    _max: { sortOrder: true },
  });

  const item = await prisma.expenseItem.create({
    data: {
      expenseMonthId: monthId,
      description: description.trim(),
      totalAmount,
      distributionType,
      targetBlock: distributionType === "block_specific" ? targetBlock : null,
      ...amounts,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
