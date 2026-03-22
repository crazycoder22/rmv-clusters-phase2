import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageChecklist } from "@/lib/roles";

async function requireChecklistAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageChecklist(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const check = await requireChecklistAdmin();
  if ("error" in check && check.error) return check.error;

  const items = await prisma.checklistItem.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const check = await requireChecklistAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { name } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    );
  }

  // Get next sort order
  const maxSort = await prisma.checklistItem.aggregate({
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const item = await prisma.checklistItem.create({
    data: { name: name.trim(), sortOrder },
  });

  return NextResponse.json({ item }, { status: 201 });
}
