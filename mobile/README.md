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

## Android setup (first-time)

Android platform isn't added yet — requires Android Studio + JDK 21. Once installed:

```bash
npx cap add android
```

## Next steps

- Google Sign-In (native, not web redirect)
- Memory game port (reuse logic from `../src/lib/memory.ts`)
- FCM push notifications
