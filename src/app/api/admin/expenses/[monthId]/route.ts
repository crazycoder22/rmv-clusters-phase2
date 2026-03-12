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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ monthId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { monthId } = await params;

  const expenseMonth = await prisma.expenseMonth.findUnique({
    where: { id: monthId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!expenseMonth) {
    return NextResponse.json({ error: "Month not found" }, { status: 404 });
  }

  return NextResponse.json({ expenseMonth });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ monthId: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { monthId } = await params;

  try {
    await prisma.expenseMonth.delete({ where: { id: monthId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Month not found" }, { status: 404 });
  }
}
