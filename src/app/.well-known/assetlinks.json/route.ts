// Digital Asset Links — required for Android App Links (the Android equivalent
// of iOS Universal Links / AASA).
//
// Android fetches this from https://www.rmvclustersphase2.in/.well-known/assetlinks.json
// (and the apex domain) to verify this site is associated with our app. Once
// verified, tapping any matching https link opens the app directly instead of
// the browser. Must be served at exactly this path, Content-Type
// application/json, over HTTPS, with no redirect.
//
// sha256_cert_fingerprints must list EVERY signing certificate that reaches a
// user's device. Verification passes if the installed app's signing cert
// matches ANY fingerprint in the list:
//   1. PLAY APP SIGNING certificate — REQUIRED for Play Store installs, because
//      Google re-signs the app with its own key. Get it from Play Console →
//      Test and release → App integrity → App signing key certificate → SHA-256.
//   2. UPLOAD key certificate (below) — covers direct-APK / internal-test builds
//      signed with our own keystore.

const SHA256_FINGERPRINTS = [
  // Upload key — keytool of onermv-release.keystore (CN=Lakshman Kamath …).
  "CE:04:2C:EB:EE:A3:91:4C:E3:C4:04:04:C6:10:75:BD:7B:E4:8E:F7:D4:26:3A:5E:AF:A2:14:8D:37:46:22:A2",
  // TODO: add the Play App Signing SHA-256 (Play Console → App integrity) so
  // links open the app for users who installed it from the Play Store.
];

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "in.rmvclustersphase2.app",
        sha256_cert_fingerprints: SHA256_FINGERPRINTS,
      },
    },
  ];

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
