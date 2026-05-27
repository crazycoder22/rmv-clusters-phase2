// JS bridge to our custom native HealthKitPlugin (see
// mobile/ios/App/App/Plugins/HealthKitPlugin.swift). On the web, every
// method short-circuits to a no-op response — pages can call freely
// without platform-guarding at every call site.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { apiFetch } from "./api";

export interface DailyStepBucket {
  /** "YYYY-MM-DD" in the device's local timezone */
  date: string;
  /** Cumulative step count for that calendar day */
  steps: number;
}

interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuth(): Promise<{ granted: boolean }>;
  readStepsByDay(opts: {
    startISO: string;
    endISO: string;
  }): Promise<{ buckets: DailyStepBucket[] }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

// ── Public helpers ──────────────────────────────────────────────────────

/** True only on a real iOS device with HealthKit data available. */
export async function isHealthKitAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { available } = await HealthKit.isAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Ask iOS for read permission on step count. iOS shows the prompt at most
 * once per app version — subsequent calls resolve immediately with the
 * cached decision. Returns true even on a denial (Apple privacy quirk) —
 * the only honest signal is whether `readStepsByDay` returns data.
 */
export async function requestHealthAuth(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { granted } = await HealthKit.requestAuth();
    return granted;
  } catch {
    return false;
  }
}

/**
 * Read daily step buckets between two timestamps. Returns [] on web or any
 * native error — pages should treat empty as "nothing to show" rather than
 * an error.
 */
export async function readStepsByDay(
  startISO: string,
  endISO: string
): Promise<DailyStepBucket[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { buckets } = await HealthKit.readStepsByDay({ startISO, endISO });
    return buckets ?? [];
  } catch (err) {
    console.warn("[healthkit] readStepsByDay failed", err);
    return [];
  }
}

// ── Sync orchestration ──────────────────────────────────────────────────

const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes

function throttleKey(eventId: string): string {
  return `stepSync:lastAt:${eventId}`;
}

export type SyncOutcome =
  | { ok: true; saved: number; skipped: number; deleted: number }
  | { ok: false; reason: "web" | "denied" | "throttled" | "network" | "none" };

interface SyncOpts {
  /** Bypass the 15-minute throttle (manual "Sync" button press). */
  force?: boolean;
}

/**
 * One-shot sync: read steps from HealthKit and POST them to the server.
 *
 * Caller passes the event window — usually `max(eventStart, rsvpCreatedAt)`
 * through "today + a few hours" to catch late Watch data. The server
 * dedupes per (rsvpId, date), so it's safe to send the full window on
 * every sync.
 */
export async function syncStepsFromHealth(
  args: {
    eventId: string;
    startISO: string;
    endISO: string;
    token: string | null;
  },
  opts: SyncOpts = {}
): Promise<SyncOutcome> {
  const { eventId, startISO, endISO, token } = args;

  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "web" };

  // Throttle unless forced.
  if (!opts.force) {
    try {
      const last = Number(localStorage.getItem(throttleKey(eventId)) ?? "0");
      if (last && Date.now() - last < THROTTLE_MS) {
        return { ok: false, reason: "throttled" };
      }
    } catch {
      /* localStorage unavailable — proceed */
    }
  }

  const granted = await requestHealthAuth();
  if (!granted) return { ok: false, reason: "denied" };

  const buckets = await readStepsByDay(startISO, endISO);
  if (buckets.length === 0) return { ok: false, reason: "none" };

  const entries = buckets
    // Drop the trivially-empty buckets to keep the wire small.
    .filter((b) => b.steps > 0)
    .map((b) => ({ date: b.date, steps: Math.round(b.steps) }));

  if (entries.length === 0) return { ok: false, reason: "none" };

  try {
    const res = await apiFetch(`/api/events/${eventId}/my-steps`, {
      method: "POST",
      token,
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) return { ok: false, reason: "network" };
    const data = await res.json();
    try {
      localStorage.setItem(throttleKey(eventId), String(Date.now()));
    } catch {
      /* ignore */
    }
    return {
      ok: true,
      saved: data?.saved ?? 0,
      skipped: data?.skipped ?? 0,
      deleted: data?.deleted ?? 0,
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}
