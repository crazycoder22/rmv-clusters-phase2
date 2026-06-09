// Shared helpers for the Stepup step-tracking flow.
//
// Used by:
//   - GET  /api/events/[id]/dashboard       (resident leaderboard)
//   - POST /api/admin/events/[id]/steps     (admin manual entry / CSV upload)
//   - POST /api/events/[id]/my-steps        (resident self-report from mobile)

import { prisma } from "@/lib/prisma";

/**
 * Convert the free-text daily-goal field that residents fill in on the RSVP
 * form (custom field response) into an integer. Accepts shorthand like "10K",
 * "5k", and plain numbers like "12000". Returns 0 if it can't parse — callers
 * use that as "no goal set, don't compute on-track stats".
 */
export function parseGoal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*K$/);
  if (match) return Math.round(parseFloat(match[1]) * 1000);
  return parseInt(cleaned, 10) || 0;
}

export interface StepUpsertEntry {
  /** ISO date string YYYY-MM-DD. The DB column stores midnight UTC. */
  date: string;
  /** Daily step count. Negative is treated as zero. */
  steps: number;
  /** Resident RSVP — provide exactly one of rsvpId or guestRsvpId. */
  rsvpId?: string;
  /** Non-resident GuestRsvp — provide exactly one of rsvpId or guestRsvpId. */
  guestRsvpId?: string;
}

export interface UpsertOptions {
  /**
   * When true (default), do NOT overwrite an existing entry with `steps > 0`
   * if the incoming `steps` is 0. Protects the case where Apple Health
   * returns no data for a day a user already manually reported on.
   */
  guardZeroOverwrite?: boolean;
  /**
   * When non-null, ignore any entry whose rsvpId/guestRsvpId doesn't match
   * (only allow self-report). Pass `{ rsvpId }` to scope to one resident.
   */
  scope?: { rsvpId?: string; guestRsvpId?: string };
}

/**
 * Batched upsert of step entries. Splits writes into BATCH_SIZE transactions
 * so we never trip Prisma's transaction-timeout on large CSV uploads.
 *
 * Returns the number of entries actually persisted (after filtering and
 * guard rules). Zero-step entries with no existing record are silently
 * dropped — there's no value storing them.
 */
export async function upsertStepEntries(
  eventConfigId: string,
  entries: StepUpsertEntry[],
  opts: UpsertOptions = {}
): Promise<{ saved: number; skipped: number; deleted: number }> {
  const { guardZeroOverwrite = true, scope } = opts;

  // Apply caller scope (self-report endpoint passes rsvpId; admin route
  // passes nothing).
  let scoped = entries;
  if (scope?.rsvpId) {
    scoped = scoped.filter((e) => e.rsvpId === scope.rsvpId);
  } else if (scope?.guestRsvpId) {
    scoped = scoped.filter((e) => e.guestRsvpId === scope.guestRsvpId);
  }

  // Bucket: positive steps go to upsert, zero steps go to delete-if-exists.
  const positives = scoped.filter(
    (e) => e.steps > 0 && (e.rsvpId || e.guestRsvpId)
  );
  const zeros = scoped.filter(
    (e) => (!e.steps || e.steps <= 0) && (e.rsvpId || e.guestRsvpId)
  );

  let saved = 0;
  let skipped = 0;
  let deleted = 0;

  // Zero-overwrite guard: peek at existing entries for the zero rows; only
  // delete those that currently have no positive value. (Cheap because zero
  // rows are rare; admin CSV uploads typically have no zeros.)
  let zerosToDelete = zeros;
  if (guardZeroOverwrite && zeros.length > 0) {
    const checks = await Promise.all(
      zeros.map(async (e) => {
        const date = new Date(e.date + "T00:00:00.000Z");
        const existing = await prisma.stepEntry.findFirst({
          where: e.rsvpId
            ? { rsvpId: e.rsvpId, date }
            : { guestRsvpId: e.guestRsvpId!, date },
          select: { steps: true },
        });
        // If there's already a positive entry, treat the incoming zero as a
        // no-op (skipped).
        if (existing && existing.steps > 0) {
          skipped++;
          return null;
        }
        return e;
      })
    );
    zerosToDelete = checks.filter((x): x is StepUpsertEntry => x !== null);
  }

  // Positive-entry upserts in BATCH_SIZE-row transactions.
  const BATCH_SIZE = 10;
  for (let i = 0; i < positives.length; i += BATCH_SIZE) {
    const batch = positives.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((entry) => {
        const date = new Date(entry.date + "T00:00:00.000Z");
        if (entry.rsvpId) {
          return prisma.stepEntry.upsert({
            where: { rsvpId_date: { rsvpId: entry.rsvpId, date } },
            create: {
              eventConfigId,
              rsvpId: entry.rsvpId,
              date,
              steps: entry.steps,
            },
            update: { steps: entry.steps },
          });
        }
        return prisma.stepEntry.upsert({
          where: {
            guestRsvpId_date: {
              guestRsvpId: entry.guestRsvpId!,
              date,
            },
          },
          create: {
            eventConfigId,
            guestRsvpId: entry.guestRsvpId,
            date,
            steps: entry.steps,
          },
          update: { steps: entry.steps },
        });
      })
    );
    saved += batch.length;
  }

  // Zero-step deletes (one batched query per RSVP type, grouped by date).
  if (zerosToDelete.length > 0) {
    for (const e of zerosToDelete) {
      const date = new Date(e.date + "T00:00:00.000Z");
      const res = await prisma.stepEntry.deleteMany({
        where: e.rsvpId
          ? { rsvpId: e.rsvpId, date }
          : { guestRsvpId: e.guestRsvpId!, date },
      });
      deleted += res.count;
    }
  }

  return { saved, skipped, deleted };
}

// ─── Always-on personal step tracking (ResidentDailySteps) ──────────────────
// Independent of step-challenge events: one row per resident per calendar day.

export interface DailyStepUpsert {
  /** ISO date YYYY-MM-DD; stored as midnight UTC. */
  date: string;
  steps: number;
}

/**
 * Upsert a resident's personal daily step counts. Same batching + zero-overwrite
 * guard semantics as upsertStepEntries, keyed by (residentId, date).
 */
export async function upsertDailySteps(
  residentId: string,
  entries: DailyStepUpsert[],
  opts: { source: string; guardZeroOverwrite?: boolean }
): Promise<{ saved: number; skipped: number; deleted: number }> {
  const { source, guardZeroOverwrite = true } = opts;
  const positives = entries.filter((e) => e.steps > 0);
  const zeros = entries.filter((e) => !e.steps || e.steps <= 0);

  let saved = 0;
  let skipped = 0;
  let deleted = 0;

  let zerosToDelete = zeros;
  if (guardZeroOverwrite && zeros.length > 0) {
    const checks = await Promise.all(
      zeros.map(async (e) => {
        const date = new Date(e.date + "T00:00:00.000Z");
        const existing = await prisma.residentDailySteps.findUnique({
          where: { residentId_date: { residentId, date } },
          select: { steps: true },
        });
        if (existing && existing.steps > 0) {
          skipped++;
          return null;
        }
        return e;
      })
    );
    zerosToDelete = checks.filter((x): x is DailyStepUpsert => x !== null);
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < positives.length; i += BATCH_SIZE) {
    const batch = positives.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((entry) => {
        const date = new Date(entry.date + "T00:00:00.000Z");
        return prisma.residentDailySteps.upsert({
          where: { residentId_date: { residentId, date } },
          create: { residentId, date, steps: entry.steps, source },
          update: { steps: entry.steps, source },
        });
      })
    );
    saved += batch.length;
  }

  for (const e of zerosToDelete) {
    const date = new Date(e.date + "T00:00:00.000Z");
    const res = await prisma.residentDailySteps.deleteMany({
      where: { residentId, date },
    });
    deleted += res.count;
  }

  return { saved, skipped, deleted };
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  steps: number;
}

/**
 * Consecutive most-recent days meeting the goal (steps > 0 when no goal set).
 * Today is given grace: if today hasn't met the goal yet, the streak is measured
 * up to yesterday rather than reset to 0. A missing day breaks the streak.
 * `todayIso` lets callers pass an IST-anchored "today" if needed.
 */
export function computeStreak(
  days: DayBucket[],
  goal: number,
  todayIso?: string
): number {
  const map = new Map(days.map((d) => [d.date, d.steps]));
  const meets = (steps: number | undefined) =>
    steps !== undefined && (goal > 0 ? steps >= goal : steps > 0);

  const cursor = todayIso
    ? new Date(todayIso + "T00:00:00.000Z")
    : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

  let streak = 0;
  for (let i = 0; i < 366; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (meets(map.get(iso))) {
      streak++;
    } else if (i === 0) {
      // Today not met yet — don't break a streak that ran through yesterday.
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      continue;
    } else {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
