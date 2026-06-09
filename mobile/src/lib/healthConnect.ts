// JS bridge to the native Android StepHealthPlugin (Health Connect). On iOS/web
// every method short-circuits, so callers don't have to platform-guard.

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { DailyStepBucket } from "./healthkit";

interface StepHealthPlugin {
  available(): Promise<{ available: boolean }>;
  requestAuth(): Promise<{ granted: boolean }>;
  readStepsByDay(opts: {
    startISO: string;
    endISO: string;
  }): Promise<{ buckets: DailyStepBucket[] }>;
}

const StepHealth = registerPlugin<StepHealthPlugin>("StepHealth");

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    return (await StepHealth.available()).available;
  } catch {
    return false;
  }
}

export async function requestHealthConnectAuth(): Promise<boolean> {
  if (Capacitor.getPlatform() !== "android") return false;
  try {
    return (await StepHealth.requestAuth()).granted;
  } catch {
    return false;
  }
}

export async function readStepsByDayHealthConnect(
  startISO: string,
  endISO: string
): Promise<DailyStepBucket[]> {
  if (Capacitor.getPlatform() !== "android") return [];
  try {
    const { buckets } = await StepHealth.readStepsByDay({ startISO, endISO });
    return buckets ?? [];
  } catch (err) {
    console.warn("[healthConnect] readStepsByDay failed", err);
    return [];
  }
}
