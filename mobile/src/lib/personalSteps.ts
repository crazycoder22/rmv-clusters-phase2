// Always-on personal step tracking: a source-agnostic layer over the device
// step sources, plus a throttled "sync my steps to the server" helper.
//
//   iOS    → "apple_health" (HealthKit) | "core_motion" (CMPedometer)
//   Android→ "health_connect" (Health Connect plugin — Phase C)
//
// Reads daily buckets from the chosen source and POSTs them to /api/me/steps.

import { Capacitor } from "@capacitor/core";
import { apiFetch } from "./api";
import {
  isHealthKitAvailable,
  requestHealthAuth,
  readStepsByDay,
  isMotionAvailable,
  readStepsByDayMotion,
  type DailyStepBucket,
} from "./healthkit";
import {
  isHealthConnectAvailable,
  requestHealthConnectAuth,
  readStepsByDayHealthConnect,
} from "./healthConnect";

export type StepSource = "apple_health" | "core_motion" | "health_connect";

/** Sensible default when the resident hasn't picked a source yet. */
export function defaultStepSource(): StepSource {
  return Capacitor.getPlatform() === "android" ? "health_connect" : "apple_health";
}

/** Which sources this device can actually offer. */
export async function availableSources(): Promise<StepSource[]> {
  const p = Capacitor.getPlatform();
  if (p === "ios") {
    const out: StepSource[] = [];
    if (await isHealthKitAvailable()) out.push("apple_health");
    if (await isMotionAvailable()) out.push("core_motion");
    return out;
  }
  if (p === "android") {
    return (await isHealthConnectAvailable()) ? ["health_connect"] : [];
  }
  return [];
}

/** Read daily step buckets from the chosen source over [startISO, endISO]. */
export async function readDailyStepsBySource(
  source: StepSource,
  startISO: string,
  endISO: string
): Promise<DailyStepBucket[]> {
  switch (source) {
    case "apple_health":
      await requestHealthAuth();
      return readStepsByDay(startISO, endISO);
    case "core_motion":
      // First call triggers the Motion & Fitness prompt natively.
      return readStepsByDayMotion(startISO, endISO);
    case "health_connect":
      await requestHealthConnectAuth();
      return readStepsByDayHealthConnect(startISO, endISO);
    default:
      return [];
  }
}

const THROTTLE_MS = 15 * 60 * 1000; // 15 minutes
const THROTTLE_KEY = "personalStepSync:lastAt";

export type PersonalSyncOutcome =
  | { ok: true; saved: number; skipped: number; deleted: number }
  | { ok: false; reason: "web" | "throttled" | "none" | "network" };

function isoStartDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Always-on personal sync: read the last `days` days from the chosen source and
 * POST them to /api/me/steps. Throttled to once / 15 min unless `force`.
 */
export async function syncPersonalSteps(args: {
  token: string | null;
  source: StepSource;
  days?: number;
  force?: boolean;
}): Promise<PersonalSyncOutcome> {
  const { token, source, days = 30, force } = args;
  if (!Capacitor.isNativePlatform()) return { ok: false, reason: "web" };

  if (!force) {
    try {
      const last = Number(localStorage.getItem(THROTTLE_KEY) ?? "0");
      if (last && Date.now() - last < THROTTLE_MS) {
        return { ok: false, reason: "throttled" };
      }
    } catch {
      /* localStorage unavailable — proceed */
    }
  }

  const startISO = isoStartDaysAgo(days - 1);
  const endISO = new Date().toISOString();
  const buckets = await readDailyStepsBySource(source, startISO, endISO);
  const entries = buckets
    .filter((b) => b.steps > 0)
    .map((b) => ({ date: b.date, steps: Math.round(b.steps) }));
  if (entries.length === 0) return { ok: false, reason: "none" };

  try {
    const res = await apiFetch("/api/me/steps", {
      method: "POST",
      token,
      body: JSON.stringify({ source, entries }),
    });
    if (!res.ok) return { ok: false, reason: "network" };
    const data = await res.json().catch(() => ({}));
    try {
      localStorage.setItem(THROTTLE_KEY, String(Date.now()));
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
