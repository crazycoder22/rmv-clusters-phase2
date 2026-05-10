# RMV Clusters Mobile

iOS + Android app for the RMV Clusters Phase 2 community, built with Capacitor + Vite + React + Tailwind 4. Talks to the same `/api/*` backend as the web (https://www.rmvclustersphase2.in).

## Stack

- **Capacitor 8** — native shell for iOS + Android
- **Vite 8** — dev server + bundler
- **React 19** + **TypeScript**
- **Tailwind CSS 4**

## Commands

```bash
npm run dev             # Vite dev server (browser)
npm run build           # Build static bundle into dist/
npx cap sync            # Copy dist/ into native projects + update plugins
npx cap open ios        # Open Xcode
npx cap open android    # Open Android Studio (after adding platform)
```

Typical iOS dev loop:

```bash
npm run build && npx cap sync ios && npx cap open ios
```

Then hit Run in Xcode (simulator or device).

## Android dev loop

```bash
npm run build && npx cap sync android && npx cap open android
```

Then hit Run in Android Studio (emulator or device).

CLI build (no Android Studio):

```bash
cd android && ./gradlew assembleDebug   # debug APK at app/build/outputs/apk/debug/
cd android && ./gradlew bundleRelease   # release AAB (requires keystore, see below)
```

Requires Android Studio + JDK 21 + Android SDK installed locally with `ANDROID_HOME` set.

## Google Sign-In on Android (one-time setup)

The Capgo social-login plugin uses `webClientId` (already wired in `src/auth/AuthProvider.tsx`) for ID-token sign-in on Android. Google identifies the calling app via **package name + signing certificate SHA-1**, both registered in Google Cloud Console — no Android-specific client ID is passed to code.

1. Get debug SHA-1 (used by Android Studio's debug builds and emulator):
   ```bash
   cd android && ./gradlew signingReport
   ```
   Look for `Variant: debug` → copy the `SHA1` line.

2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Credentials** → **Create credentials** → **OAuth client ID**:
   - Application type: **Android**
   - Package name: `in.rmvclustersphase2.app`
   - SHA-1: paste from step 1
3. Repeat step 2 for the **release** keystore SHA-1 once it exists (see next section).

The existing **Web** client (`GOOGLE_WEB_CLIENT_ID` in `src/config.ts`) is what gets baked into the issued ID token's `aud` claim, so the backend `/api/auth/mobile` keeps verifying the same way for both platforms.

## Release signing (Android)

`android/app/build.gradle` reads release signing config from `android/keystore.properties` (gitignored). Template at `android/keystore.properties.example`.

1. Generate a release keystore (one-time, **back this file up securely**):
   ```bash
   keytool -genkey -v -keystore android/release.jks \
     -alias rmv-clusters-release -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Copy the template and fill in:
   ```bash
   cp android/keystore.properties.example android/keystore.properties
   # edit storePassword, keyPassword
   ```
3. Get release SHA-1 and register it in Google Cloud Console (same flow as debug):
   ```bash
   keytool -list -v -keystore android/release.jks -alias rmv-clusters-release
   ```
4. Build the AAB for Play Store:
   ```bash
   cd android && ./gradlew bundleRelease
   # output: app/build/outputs/bundle/release/app-release.aab
   ```

If `keystore.properties` is missing, release builds fall back to unsigned — local debug development continues to work unchanged.

## Push notifications (Android, when needed)

`android/app/build.gradle` auto-detects a `google-services.json` file in `android/app/`. Drop one in (from Firebase console for the same `in.rmvclustersphase2.app` package) and the google-services Gradle plugin applies on the next build. Required only if/when `@capacitor/push-notifications` is added.

## Next steps

- Memory game port (reuse logic from `../src/lib/memory.ts`)
- FCM push notifications
