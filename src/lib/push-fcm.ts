// Firebase Cloud Messaging (FCM) sender for Android pushes. Mirror of the
// APNs path in src/lib/push.ts — same input contract (tokens + opts) and
// same output shape (sent/failed/invalidTokens) so the multiplexer in
// sendPushToResidents can route by platform without caring about the
// transport details.
//
// Env vars required:
//   FCM_SERVICE_ACCOUNT_JSON — base64-encoded contents of the Firebase
//                              Admin SDK service-account JSON, downloaded
//                              from Firebase Console → Project settings →
//                              Service accounts → Generate new private key.
//                              The Vercel env var stores it base64 so the
//                              multi-line JSON doesn't choke on Vercel's
//                              UI.
//
// If the env var is missing the module silently no-ops the same way push.ts
// does for APNs — lets backend code call this before Android is wired.
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getMessaging as getAdminMessaging, type Messaging } from "firebase-admin/messaging";

let cachedMessaging: Messaging | null = null;
let cachedInitFailed = false;

function getMessaging(): Messaging | null {
  if (cachedMessaging) return cachedMessaging;
  if (cachedInitFailed) return null;

  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    // Vercel stores the JSON base64-encoded so the multi-line PEM block
    // doesn't break in the env-var UI. Fall back to raw JSON if it doesn't
    // look base64 (handy for local .env.local edits).
    let jsonText: string;
    if (raw.trim().startsWith("{")) {
      jsonText = raw;
    } else {
      jsonText = Buffer.from(raw, "base64").toString("utf-8");
    }
    const creds = JSON.parse(jsonText);

    // If another path in the process already initialized the default app
    // (e.g. a hot-reload picking up a stale module), reuse it.
    const app: App =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert(creds),
            projectId: creds.project_id,
          });

    cachedMessaging = getAdminMessaging(app);
    return cachedMessaging;
  } catch (err) {
    console.error(
      "[push-fcm] failed to initialize firebase-admin from FCM_SERVICE_ACCOUNT_JSON:",
      err
    );
    cachedInitFailed = true;
    return null;
  }
}

export interface FcmPushOptions {
  title: string;
  body: string;
  /** Custom payload — same shape we send to APNs. All values coerced to
   *  strings because FCM only accepts string-valued data payloads. */
  data?: Record<string, string | number | boolean>;
  sound?: string;
}

export interface FcmPushResult {
  sent: number;
  failed: number;
  invalidTokens: string[];
}

/**
 * Send to a list of Android device tokens via FCM. Mirrors sendPush() over
 * APNs — same input contract, same return shape so the dispatcher in
 * push.ts doesn't have to care about the transport.
 */
export async function sendPushFcm(
  tokens: string[],
  opts: FcmPushOptions
): Promise<FcmPushResult> {
  const result: FcmPushResult = { sent: 0, failed: 0, invalidTokens: [] };
  if (tokens.length === 0) return result;

  const messaging = getMessaging();
  if (!messaging) {
    console.warn(
      "[push-fcm] FCM_SERVICE_ACCOUNT_JSON not set — sendPushFcm is a no-op."
    );
    return result;
  }

  // FCM expects all data values to be strings. Coerce numbers/booleans the
  // mobile side knows to parse if it cares about types.
  const dataPayload: Record<string, string> = {};
  if (opts.data) {
    for (const [k, v] of Object.entries(opts.data)) {
      dataPayload[k] = String(v);
    }
  }

  try {
    // sendEachForMulticast is the official batched call — it handles up to
    // 500 tokens per request and gives us per-token responses so we can
    // identify dead tokens to prune.
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: opts.title, body: opts.body },
      data: dataPayload,
      android: {
        priority: "high",
        notification: {
          sound: opts.sound ?? "default",
        },
      },
    });
    result.sent = res.successCount;
    result.failed = res.failureCount;
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error?.code;
      // These are FCM's "permanently invalid" codes — token is dead and
      // we should prune it from the DB so we stop trying.
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-argument" ||
        code === "messaging/invalid-registration-token"
      ) {
        result.invalidTokens.push(tokens[idx]);
      }
    });
  } catch (err) {
    console.error("[push-fcm] sendEachForMulticast failed:", err);
    result.failed = tokens.length;
  }

  return result;
}
