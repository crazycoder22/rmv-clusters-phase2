import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../auth/AuthProvider";
import {
  syncPersonalSteps,
  defaultStepSource,
  type StepSource,
} from "../lib/personalSteps";

// Invisible component — always-on personal step sync (independent of any step
// challenge). On mount + on every app foreground, reads the last 30 days from
// the resident's chosen source and POSTs to /api/me/steps. The personalSteps
// helper throttles to once / 15 min. Silent best-effort; the My Steps page has
// a manual "Sync now" button that forces a sync.
export default function PersonalStepSyncMount() {
  const { token, user } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!token) return;
    const source: StepSource =
      (user?.stepSource as StepSource | undefined) ?? defaultStepSource();

    let cancelled = false;
    async function sync() {
      if (inFlight.current || cancelled) return;
      inFlight.current = true;
      try {
        await syncPersonalSteps({ token, source });
      } catch {
        /* silent best-effort */
      } finally {
        inFlight.current = false;
      }
    }

    void sync();

    let handle: { remove: () => Promise<void> } | null = null;
    void CapApp.addListener("appStateChange", (s) => {
      if (s.isActive) void sync();
    }).then((h) => {
      handle = h;
    });

    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, [token, user?.stepSource]);

  return null;
}
