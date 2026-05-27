import { useEffect, useRef } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { syncStepsFromHealth } from "../lib/healthkit";

interface StepEvent {
  announcementId: string;
  startDate: string;
  endDate: string;
  rsvpCreatedAt: string;
}

// Invisible component — mirrors PushNotificationsMount. Lives inside the
// signed-in HashRouter, so it has the JWT.
//
// On mount + on every app foreground, it:
//   1. Fetches the caller's active step events.
//   2. For each one, calls syncStepsFromHealth (throttled to once per 15 min
//      per event in the healthkit helper itself).
//
// No UI; failures are silent — the detail page surfaces sync errors when
// the user hits the manual button.
export default function StepSyncMount() {
  const { token } = useAuth();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!token) return;

    let cancelled = false;

    async function syncAll() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await apiFetch("/api/me/step-events", { token });
        if (!res.ok) return;
        const data = await res.json();
        const events: StepEvent[] = data?.events ?? [];
        for (const e of events) {
          if (cancelled) break;
          const startISO = new Date(
            Math.max(
              new Date(e.startDate).getTime(),
              new Date(e.rsvpCreatedAt).getTime()
            )
          ).toISOString();
          const endISO = new Date().toISOString();
          await syncStepsFromHealth({
            eventId: e.announcementId,
            startISO,
            endISO,
            token,
          });
        }
      } catch {
        /* silent — best-effort background sync */
      } finally {
        inFlight.current = false;
      }
    }

    // Cold-start sync.
    void syncAll();

    // Foreground sync.
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    void CapApp.addListener("appStateChange", (s) => {
      if (s.isActive) void syncAll();
    }).then((h) => {
      listenerHandle = h;
    });

    return () => {
      cancelled = true;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, [token]);

  return null;
}
