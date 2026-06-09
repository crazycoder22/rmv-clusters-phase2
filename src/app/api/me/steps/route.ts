import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { upsertDailySteps, computeStreak, type DayBucket } from "@/lib/steps";

export const dynamic = "force-dynamic";

const VALID_SOURCES = ["apple_health", "core_motion", "health_connect", "manual"];

// GET /api/me/steps?days=30 → personal daily step history + computed summary.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1),
    400
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const since = new Date(todayIso + "T00:00:00.000Z");
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const rows = await prisma.residentDailySteps.findMany({
    where: { residentId: me.id, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, steps: true },
  });
  const buckets: DayBucket[] = rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    steps: r.steps,
  }));

  const goal = me.dailyStepGoal ?? 0;
  const today = buckets.find((b) => b.date === todayIso)?.steps ?? 0;
  const total = buckets.reduce((s, b) => s + b.steps, 0);
  const daysTracked = buckets.length;
  const average = daysTracked ? Math.round(total / daysTracked) : 0;
  const best = buckets.reduce((m, b) => Math.max(m, b.steps), 0);
  const streak = computeStreak(buckets, goal, todayIso);

  return NextResponse.json({
    days: buckets,
    today,
    total,
    average,
    best,
    streak,
    goal,
    daysTracked,
    source: me.stepSource ?? null,
  });
}

// POST /api/me/steps → upsert the caller's own daily step counts.
// Body: { source, entries: [{ date: "YYYY-MM-DD", steps }] }
export async function POST(request: Request) {
  const me = await getAuthedResident(request);
  if (!me || !me.isApproved) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries[] is required" },
      { status: 400 }
    );
  }
  const source: string = VALID_SOURCES.includes(body.source)
    ? body.source
    : "manual";

  const entries = body.entries
    .filter(
      (e: unknown): e is { date: string; steps: number } =>
        !!e &&
        typeof (e as { date?: unknown }).date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test((e as { date: string }).date) &&
        typeof (e as { steps?: unknown }).steps === "number" &&
        (e as { steps: number }).steps >= 0 &&
        (e as { steps: number }).steps <= 500000
    )
    .map((e: { date: string; steps: number }) => ({
      date: e.date,
      steps: Math.round(e.steps),
    }));

  const result = await upsertDailySteps(me.id, entries, { source });
  return NextResponse.json(result);
}
