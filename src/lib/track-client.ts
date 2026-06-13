"use client";

// Fire-and-forget page-view ping (web). Cookie-authed — the server records the
// resident + platform="web". Never throws into render; failures are ignored.
export function track(feature: string, pageKey: string, entityId?: string): void {
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature, pageKey, entityId }),
  }).catch(() => {});
}
