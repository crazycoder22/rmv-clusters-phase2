import { NextResponse } from "next/server";
import { getAuthedResident } from "@/lib/api-auth";
import { isSuperAdmin } from "@/lib/roles";
import { istTodayYmd } from "@/lib/habits";
import { DAILY_JOBS } from "@/lib/jobs/registry";

export const dynamic = "force-dynamic";
// Give jobs room to run (push fan-out etc.). Vercel caps this per plan.
export const maxDuration = 60;

// GET /api/cron/daily — runs every registered daily job.
//
// Triggered two ways:
//   1. Vercel Cron (see vercel.json). Vercel attaches
//      `Authorization: Bearer <CRON_SECRET>` automatically when the
//      CRON_SECRET env var is set.
//   2. Manual run by a SUPERADMIN (bearer JWT or web cookie) for testing —
//      optionally `?job=<id>` to run a single job.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  let authorized = false;
  let trigger = "cron";

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true;
  } else {
    // Fall back to a signed-in SUPERADMIN (manual test trigger).
    const me = await getAuthedResident(request);
    if (me && isSuperAdmin(me.roles)) {
      authorized = true;
      trigger = "manual";
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const only = searchParams.get("job");

  // Which reminder wave? The morning cron passes ?wave=MORNING; the original
  // evening cron has no param → defaults to EVENING, so existing jobs keep
  // their once-a-day behaviour untouched.
  const wave = searchParams.get("wave") === "MORNING" ? "MORNING" : "EVENING";

  const ctx = { todayYmd: istTodayYmd(), now: new Date(), wave } as const;
  // Run jobs scheduled for this wave (absent waves ⇒ EVENING only).
  const waveJobs = DAILY_JOBS.filter((j) => (j.waves ?? ["EVENING"]).includes(wave));
  const jobs = only ? waveJobs.filter((j) => j.id === only) : waveJobs;

  if (only && jobs.length === 0) {
    return NextResponse.json(
      { error: `No job with id "${only}" for wave ${wave}`, available: DAILY_JOBS.map((j) => j.id) },
      { status: 404 }
    );
  }

  const results = [];
  for (const job of jobs) {
    try {
      const r = await job.run(ctx);
      results.push({ job: job.id, ...r });
    } catch (err) {
      console.error(`[cron] job ${job.id} threw:`, err);
      results.push({ job: job.id, ok: false, detail: String(err) });
    }
  }

  console.log(
    `[cron] daily run (${trigger}) ${ctx.todayYmd}:`,
    JSON.stringify(results)
  );

  return NextResponse.json({
    ranAt: ctx.now.toISOString(),
    today: ctx.todayYmd,
    wave,
    trigger,
    results,
  });
}
