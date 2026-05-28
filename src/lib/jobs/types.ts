// Generic daily-jobs framework.
//
// A "daily job" is any server-side task we want to run once a day on a
// schedule — habit reminders today, but designed so future tasks (RSVP
// deadline reminders, step-sync nudges, weekly digests, cleanup, etc.) are
// just new modules added to the registry. One Vercel Cron entry hits the
// dispatcher (/api/cron/daily); the dispatcher runs every registered job.
// Adding a job needs NO new cron config and does not count against the
// platform's cron-job quota.

export interface DailyJobContext {
  /** IST civil date "YYYY-MM-DD" — all jobs share one notion of "today". */
  todayYmd: string;
  /** Wall-clock instant the dispatcher started. */
  now: Date;
}

export interface DailyJobResult {
  ok: boolean;
  /** Human-readable one-liner for logs / the dispatcher response. */
  detail: string;
  /** Optional structured counters (e.g. { notified: 5, pending: 12 }). */
  metrics?: Record<string, number>;
}

export interface DailyJob {
  /** URL-safe unique id, also used by ?job= to run a single job manually. */
  id: string;
  /** Short description of what the job does. */
  description: string;
  /** Do the work. Should swallow its own non-fatal errors where sensible. */
  run(ctx: DailyJobContext): Promise<DailyJobResult>;
}
