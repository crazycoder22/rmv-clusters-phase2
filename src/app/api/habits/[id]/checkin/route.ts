import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";
import { istTodayYmd, istYmd, ymdToInstant, isValidYmd } from "@/lib/habits";

export const dynamic = "force-dynamic";

// POST /api/habits/[id]/checkin — owner marks a day done.
// Body: { date?: "YYYY-MM-DD" } — defaults to IST today. The date must fall
// within [startDate, endDate] and not be in the future. Idempotent (upsert).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.ownerId !== me.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const today = istTodayYmd();
  const dateYmd: string =
    typeof body?.date === "string" && body.date ? body.date : today;

  if (!isValidYmd(dateYmd)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Bounds: within the habit window, never the future.
  const startYmd = istYmd(habit.startDate);
  const endYmd = istYmd(habit.endDate);
  if (dateYmd < startYmd || dateYmd > endYmd) {
    return NextResponse.json(
      { error: "Date is outside the habit's range" },
      { status: 400 }
    );
  }
  if (dateYmd > today) {
    return NextResponse.json(
      { error: "Can't mark a future day" },
      { status: 400 }
    );
  }

  const dateInstant = ymdToInstant(dateYmd);
  await prisma.habitCheckin.upsert({
    where: { habitId_date: { habitId: id, date: dateInstant } },
    create: { habitId: id, date: dateInstant },
    update: {},
  });

  return NextResponse.json({ ok: true, date: dateYmd });
}

// DELETE /api/habits/[id]/checkin?date=YYYY-MM-DD — owner unmarks a day.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.ownerId !== me.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dateYmd = searchParams.get("date") || istTodayYmd();
  if (!isValidYmd(dateYmd)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  await prisma.habitCheckin.deleteMany({
    where: { habitId: id, date: ymdToInstant(dateYmd) },
  });

  return NextResponse.json({ ok: true });
}
