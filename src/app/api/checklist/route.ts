import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canFillChecklist } from "@/lib/roles";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check that user is approved
  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (!resident?.isApproved) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // e.g. "2026-03"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month parameter required in YYYY-MM format" },
      { status: 400 }
    );
  }

  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0); // last day of month

  const [items, entries] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.checklistEntry.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        item: { active: true },
      },
      include: {
        filledBy: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({ items, entries, daysInMonth: endDate.getDate() });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canFillChecklist(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (!resident) {
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });
  }

  const body = await request.json();
  const { date, itemId, done } = body;

  if (!date || !itemId || typeof done !== "boolean") {
    return NextResponse.json(
      { error: "date, itemId, and done (boolean) are required" },
      { status: 400 }
    );
  }

  const dateObj = new Date(date);

  const entry = await prisma.checklistEntry.upsert({
    where: {
      date_itemId: { date: dateObj, itemId },
    },
    update: { done, filledById: resident.id },
    create: {
      date: dateObj,
      itemId,
      done,
      filledById: resident.id,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
