import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!canManageAnnouncements(session.user.roles)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session };
}

// GET /api/admin/housekeeping/feedback?month=4&year=2026&block=1
export async function GET(req: NextRequest) {
  const check = await requireAdmin();
  if ("error" in check) return check.error;

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? "");
  const year = parseInt(searchParams.get("year") ?? "");
  const blockParam = searchParams.get("block");
  const block = blockParam ? parseInt(blockParam) : undefined;

  if (!month || !year) return NextResponse.json({ error: "month and year are required" }, { status: 400 });

  const where: Record<string, unknown> = { month, year };
  if (block) where.block = block;

  const feedback = await prisma.hKFeedback.findMany({
    where,
    include: { resident: { select: { id: true, name: true, block: true, flatNumber: true } } },
    orderBy: [{ block: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ feedback });
}
