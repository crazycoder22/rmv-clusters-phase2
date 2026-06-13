"use client";

import { useEffect, useRef } from "react";

// Fire-and-forget page-view ping (web). Cookie-authed — the server records the
// resident + platform="web". Never throws into render; failures are ignored.
export function track(feature: string, pageKey: string, entityId?: string): void {
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature, pageKey, entityId }),
  }).catch(() => {});
}

function sendDwell(
  feature: string,
  pageKey: string,
  entityId: string | undefined,
  durationMs: number,
  useBeacon: boolean
): void {
  const payload = JSON.stringify({ feature, pageKey, entityId, durationMs });
  // On real page unload, sendBeacon survives where fetch would be cancelled.
  if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

// Measure how long the page is actually visible and report it as a dwell time.
// Accumulates only foreground time (pauses while the tab is hidden), and flushes
// on tab-hide, real unload, and React unmount (SPA navigation). `enabled` should
// flip true once the page's content has loaded, so we don't time error states.
export function useDwell(
  feature: string,
  pageKey: string,
  entityId: string | undefined,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled) return;
    let acc = 0; // accumulated visible ms
    let since: number | null = Date.now(); // when the current visible stretch began
    let lastSent = 0;

    const visibleMs = () => acc + (since != null ? Date.now() - since : 0);

    const flush = (useBeacon: boolean) => {
      const ms = visibleMs();
      if (ms < 1000 || ms - lastSent < 1000) return; // ignore sub-second + redundant
      lastSent = ms;
      sendDwell(feature, pageKey, entityId, ms, useBeacon);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (since != null) { acc += Date.now() - since; since = null; }
        flush(true);
      } else if (since == null) {
        since = Date.now();
      }
    };
    const onPageHide = () => flush(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(false); // SPA route change — page isn't unloading, fetch is fine
    };
  }, [enabled, feature, pageKey, entityId]);
}
