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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ monthId: string; itemId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { itemId } = await params;
  const body = await request.json();
  const { description, totalAmount, distributionType, targetBlock, customAmounts } = body;

  const amounts = calculateBlockAmounts(
    totalAmount,
    distributionType as DistributionType,
    targetBlock,
    customAmounts
  );

  const item = await prisma.expenseItem.update({
    where: { id: itemId },
    data: {
      description: description.trim(),
      totalAmount,
      distributionType,
      targetBlock: distributionType === "block_specific" ? targetBlock : null,
      ...amounts,
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ monthId: string; itemId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { itemId } = await params;

  try {
    await prisma.expenseItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
}
