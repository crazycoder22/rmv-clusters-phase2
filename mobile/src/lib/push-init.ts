// Push notification wiring for the Capacitor mobile shell.
//
// What this does:
//   1. On signed-in mount, asks iOS for notification permission.
//   2. Once granted, registers with APNs and posts the device token to
//      our backend (POST /api/push/register).
//   3. Listens for taps on delivered notifications and deep-links into
//      the right page based on the `type` field in the payload we send
//      from the server (see src/lib/push.ts).
//
// On the web (cap run dev outside an iOS shell) this entire module is a
// no-op — Capacitor.isNativePlatform() returns false and we exit early.

import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { apiFetch } from "./api";

type NavigateFn = (path: string) => void;

let registered = false;
let listenersInstalled = false;
let lastRegisteredToken: string | null = null;

/**
 * Call this from the signed-in part of the app (after we have a JWT). Safe
 * to call multiple times — registration listeners are installed once,
 * permission is asked once.
 */
export async function initPushNotifications(
  jwt: string | null,
  navigate: NavigateFn
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return; // web: bail
  if (registered) return;
  registered = true;

  // Install event listeners FIRST. If we register before they're wired up,
  // we'd miss the initial 'registration' callback on a cold start.
  if (!listenersInstalled) {
    listenersInstalled = true;

    // Fires when iOS returns an APNs device token after register().
    await PushNotifications.addListener("registration", async (token: Token) => {
      const value = token.value;
      if (!value || value === lastRegisteredToken) return;
      lastRegisteredToken = value;
      try {
        await apiFetch("/api/push/register", {
          method: "POST",
          token: jwt,
          body: JSON.stringify({ token: value, platform: "ios" }),
        });
      } catch (err) {
        console.warn("[push] failed to upload device token", err);
      }
    });

    // Fires when registration FAILS (eg. simulator, missing entitlement).
    await PushNotifications.addListener("registrationError", (err) => {
      console.warn("[push] registration error", err);
    });

    // Fires when a notification is tapped from the lock screen, banner or
    // notification center. We use the `type` + `id` we send from the
    // server to navigate to the right page.
    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        const data = (action?.notification?.data ?? {}) as Record<
          string,
          string
        >;
        const type = data?.type;
        try {
          if (type === "announcement") {
            navigate("/news");
          } else if (type === "medal") {
            navigate("/more"); // medals list lives under More → admin
          } else if (type === "issue" && data?.id) {
            navigate(`/issues/${data.id}`);
          } else if (type?.startsWith("habit")) {
            // habit_invite / habit_accepted / habit_nudge — deep-link to the
            // habit if we have an id, else the habits list (invites show there).
            navigate(data?.id ? `/habits/${data.id}` : "/habits");
          } else if (type === "post" && data?.id) {
            // Comment on the resident's community post → open that post.
            navigate(`/community/${data.id}`);
          } else if (type === "initiative") {
            navigate(data?.id ? `/initiatives/${data.id}` : "/initiatives");
          } else if (type === "referendum") {
            navigate(data?.id ? `/referendums/${data.id}` : "/referendums");
          } else if (
            type === "parking_booked" ||
            type === "parking_payment" ||
            type === "parking_cancelled"
          ) {
            navigate(data?.id ? `/parking/${data.id}` : "/parking");
          } else if (type === "duty") {
            navigate("/duties");
          } else if (type === "message" && data?.id) {
            navigate(`/messages/${data.id}`);
          } else if (type === "group_poll" && data?.groupId && data?.id) {
            navigate(`/groups/${data.groupId}/polls/${data.id}`);
          } else if (type === "sos" && data?.id) {
            navigate(`/sos/${data.id}`);
          } else {
            navigate("/");
          }
        } catch (err) {
          console.warn("[push] navigate after tap failed", err);
        }
      }
    );
  }

  // Ask permission (no-op on subsequent calls — iOS remembers the choice).
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    // User said no. Nothing more to do; respect their choice. They can
    // re-enable from iOS Settings → Notifications → RMV.
    return;
  }

  // Kick off APNs registration. The token will arrive via the
  // 'registration' listener installed above.
  await PushNotifications.register();
}

/**
 * Best-effort: tell the server to drop this device's token on sign-out so
 * future pushes don't ping a logged-out phone. The JWT used here is the
 * one that was active right before sign-out.
 */
export async function unregisterPushNotifications(
  jwt: string | null
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!lastRegisteredToken) return;
  try {
    await apiFetch(
      `/api/push/register?token=${encodeURIComponent(lastRegisteredToken)}`,
      { method: "DELETE", token: jwt }
    );
  } catch {
    // ignore
  }
  lastRegisteredToken = null;
  registered = false;
}
