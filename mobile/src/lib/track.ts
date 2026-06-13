import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { apiFetch } from "./api";

// Fire-and-forget page-view ping (mobile). The bearer token authenticates the
// resident; apiFetch tags the platform (ios/android). No-op when signed out.
// Never throws; failures are ignored.
export function track(
  token: string | null,
  feature: string,
  pageKey: string,
  entityId?: string
): void {
  if (!token) return;
  void apiFetch("/api/track", {
    method: "POST",
    token,
    body: JSON.stringify({ feature, pageKey, entityId }),
  }).catch(() => {});
}

function sendDwell(
  token: string,
  feature: string,
  pageKey: string,
  entityId: string | undefined,
  durationMs: number
): void {
  void apiFetch("/api/track", {
    method: "POST",
    token,
    body: JSON.stringify({ feature, pageKey, entityId, durationMs }),
  }).catch(() => {});
}

// Measure how long the page is actually visible and report it as a dwell time.
// Accumulates only foreground time (pauses when the app is backgrounded), and
// flushes on background, web-visibility-hide, and React unmount (route change).
// `enabled` should flip true once the page's content has loaded.
export function useDwell(
  token: string | null,
  feature: string,
  pageKey: string,
  entityId: string | undefined,
  enabled: boolean
): void {
  useEffect(() => {
    if (!enabled || !token) return;
    let acc = 0; // accumulated visible ms
    let since: number | null = Date.now();
    let lastSent = 0;

    const visibleMs = () => acc + (since != null ? Date.now() - since : 0);
    const pause = () => { if (since != null) { acc += Date.now() - since; since = null; } };
    const resume = () => { if (since == null) since = Date.now(); };

    const flush = () => {
      const ms = visibleMs();
      if (ms < 1000 || ms - lastSent < 1000) return;
      lastSent = ms;
      sendDwell(token, feature, pageKey, entityId, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") { pause(); flush(); } else resume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Native background/foreground (the reliable signal inside the WebView).
    let handle: PluginListenerHandle | null = null;
    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) { pause(); flush(); } else resume();
    }).then((h) => { handle = h; });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void handle?.remove();
      flush();
    };
  }, [enabled, token, feature, pageKey, entityId]);
}
