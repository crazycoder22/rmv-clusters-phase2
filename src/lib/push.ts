// APNs push notification sender.
//
// Talks directly to Apple's HTTP/2 APNs gateway using a .p8 auth key. We
// keep a single shared `apn.Provider` for the lifetime of the Node process
// so the HTTP/2 connection is reused across calls (Apple recommends this).
//
// Env vars required (all four — anything missing makes sendPush a no-op):
//   APNS_KEY_ID      — 10-char Key ID from developer.apple.com
//   APNS_TEAM_ID     — your Apple Developer Team ID (W59Y6WK5HG for us)
//   APNS_BUNDLE_ID   — iOS bundle identifier, e.g. in.rmvclustersphase2.app
//   APNS_AUTH_KEY    — contents of the .p8 file
//                       (the multi-line text including the BEGIN/END lines)
//
// Optional:
//   APNS_PRODUCTION  — "true" to use production gateway, anything else uses
//                       sandbox. We default to PRODUCTION when running on
//                       Vercel and SANDBOX otherwise, because the .p8 key
//                       (when issued for "Sandbox & Production") is valid
//                       for both — what matters is which gateway you hit.
//                       Builds installed from TestFlight use the production
//                       APNs environment, NOT the dev one (counter-intuitive
//                       but it's how Apple works).

import apn from "apn";
import { prisma } from "@/lib/prisma";
import { sendPushFcm } from "@/lib/push-fcm";

let cachedProvider: apn.Provider | null = null;
let cachedProviderEnv: string | null = null;

function getProvider(): apn.Provider | null {
  const key = process.env.APNS_AUTH_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  if (!key || !keyId || !teamId) {
    return null; // silently disabled until env is configured
  }

  // TestFlight + App Store builds use the production APNs environment.
  // Local development against a debug build (sideloaded from Xcode) uses
  // sandbox. We default to production on Vercel.
  const production =
    process.env.APNS_PRODUCTION === "true" || !!process.env.VERCEL;
  const env = production ? "prod" : "sandbox";

  if (cachedProvider && cachedProviderEnv === env) return cachedProvider;

  if (cachedProvider) {
    // Env switched (rare — only really happens in tests). Tear down the old
    // one so the next caller gets a fresh provider against the new gateway.
    cachedProvider.shutdown();
    cachedProvider = null;
  }

  cachedProvider = new apn.Provider({
    token: {
      key, // raw .p8 contents — `apn` lib accepts a string here
      keyId,
      teamId,
    },
    production,
  });
  cachedProviderEnv = env;
  return cachedProvider;
}

export interface PushOptions {
  /** Required short alert title (e.g. "📢 New announcement"). */
  title: string;
  /** Required body — the longer line shown under the title. */
  body: string;
  /**
   * Optional custom payload to deliver alongside the alert. Used by the
   * mobile app to deep-link into a specific page when the user taps the
   * notification. Keys must be JSON-serializable strings/numbers.
   *
   * Common pattern:
   *   { type: "announcement", id: "abc123" }
   *   { type: "medal", id: "xyz789" }
   *   { type: "issue", id: "qrs456" }
   */
  data?: Record<string, string | number | boolean>;
  /** Optional badge count to set on the app icon. */
  badge?: number;
  /** Optional sound — "default" for the standard ping. */
  sound?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  // Tokens that came back as unregistered/invalid — caller should delete
  // them from the DB so we stop trying.
  invalidTokens: string[];
}

/**
 * Send a single notification to a list of device tokens.
 *
 * Safe to call from any route handler. If APNs env vars aren't set yet,
 * this becomes a no-op (returns { sent: 0, failed: 0 }) so feature work
 * can land before the key is wired up.
 *
 * Failures are swallowed — push is best-effort. We DO collect invalid
 * tokens so callers can prune them; pass `pruneInvalidTokens: true` to
 * have this function delete them for you.
 */
export async function sendPush(
  tokens: string[],
  opts: PushOptions,
  { pruneInvalidTokens = true }: { pruneInvalidTokens?: boolean } = {}
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };
  if (tokens.length === 0) return result;

  const provider = getProvider();
  if (!provider) {
    // Env not configured yet — silently no-op. Log so it's obvious in dev
    // why pushes "aren't arriving".
    console.warn(
      "[push] APNS env vars not set — sendPush is a no-op. " +
        "Set APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_AUTH_KEY to enable."
    );
    return result;
  }

  const bundleId =
    process.env.APNS_BUNDLE_ID ?? "in.rmvclustersphase2.app";

  const note = new apn.Notification();
  note.topic = bundleId;
  note.alert = { title: opts.title, body: opts.body };
  note.sound = opts.sound ?? "default";
  if (opts.badge !== undefined) note.badge = opts.badge;
  if (opts.data) {
    note.payload = { ...opts.data };
  }
  // 1 hour TTL — if Apple can't deliver within that window the message is
  // dropped (preventing a stale "new announcement" from arriving the next
  // day when the device comes back online).
  note.expiry = Math.floor(Date.now() / 1000) + 60 * 60;
  // pushType is required by APNs for alert notifications. The `apn` lib's
  // types are slightly out of date so we cast — it's a real string field
  // on the underlying Notification class.
  (note as unknown as { pushType: string }).pushType = "alert";

  try {
    const res = await provider.send(note, tokens);
    result.sent = res.sent.length;
    result.failed = res.failed.length;
    for (const f of res.failed) {
      const reason = f.response?.reason;
      // BadDeviceToken / Unregistered = token is dead, prune it.
      if (reason === "BadDeviceToken" || reason === "Unregistered") {
        result.invalidTokens.push(f.device);
      }
    }
  } catch (err) {
    console.error("[push] sendPush failed:", err);
    result.failed = tokens.length;
  }

  if (pruneInvalidTokens && result.invalidTokens.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: result.invalidTokens } },
      });
    } catch (err) {
      console.error("[push] failed to prune invalid tokens:", err);
    }
  }

  return result;
}

/**
 * Convenience: look up every device token for the given residents and send
 * one notification to all of them. Use this when you want to broadcast
 * something to a list of users (e.g., everyone gets a new announcement).
 *
 * Pass `null` or an empty array to broadcast to ALL approved residents.
 */
export async function sendPushToResidents(
  residentIds: string[] | null,
  opts: PushOptions
): Promise<PushResult> {
  const where = residentIds && residentIds.length > 0
    ? { residentId: { in: residentIds } }
    : { resident: { isApproved: true } };

  // Fetch token + platform so we can dispatch each device through the right
  // transport: iOS via APNs, Android via FCM. (Web tokens currently nowhere
  // — would need Web Push setup; ignored here.)
  const rows = await prisma.deviceToken.findMany({
    where,
    select: { token: true, platform: true },
  });

  if (rows.length === 0) {
    return { sent: 0, failed: 0, invalidTokens: [] };
  }

  const iosTokens: string[] = [];
  const androidTokens: string[] = [];
  for (const r of rows) {
    if (r.platform === "android") androidTokens.push(r.token);
    else if (r.platform === "ios") iosTokens.push(r.token);
    // Other platforms (e.g. "web") fall through — no transport wired yet.
  }

  // Fire both transports in parallel — each silently no-ops if its env
  // vars aren't set, so an APNs-only deploy still works unchanged.
  const [iosRes, androidRes] = await Promise.all([
    iosTokens.length > 0
      ? sendPush(iosTokens, opts)
      : Promise.resolve({ sent: 0, failed: 0, invalidTokens: [] } as PushResult),
    androidTokens.length > 0
      ? sendPushFcm(androidTokens, opts)
      : Promise.resolve({ sent: 0, failed: 0, invalidTokens: [] }),
  ]);

  // Prune any Android tokens FCM reported as dead — APNs pruning already
  // happens inside sendPush().
  if (androidRes.invalidTokens.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: androidRes.invalidTokens } },
      });
    } catch (err) {
      console.error("[push] failed to prune invalid FCM tokens:", err);
    }
  }

  return {
    sent: iosRes.sent + androidRes.sent,
    failed: iosRes.failed + androidRes.failed,
    invalidTokens: [...iosRes.invalidTokens, ...androidRes.invalidTokens],
  };
}
