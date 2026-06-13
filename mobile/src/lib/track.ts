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
