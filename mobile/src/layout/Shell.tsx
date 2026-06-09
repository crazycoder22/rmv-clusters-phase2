import { type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import BottomNav from "./BottomNav";

// Wraps the routed content with a fixed bottom navigation bar. The reserved
// space below the main area = 52px tab height + 10px breathing room + device
// safe-area inset, with an extra 48px on Android to clear the system gesture
// bar on Samsung One UI (matches the matching fallback in BottomNav.tsx).
const ANDROID_NAV_BAR_FALLBACK_PX = 48;
const reservedBottom =
  Capacitor.getPlatform() === "android"
    ? `calc(env(safe-area-inset-bottom, 0px) + 62px + ${ANDROID_NAV_BAR_FALLBACK_PX}px)`
    : "calc(env(safe-area-inset-bottom, 0px) + 62px)";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main
        className="flex flex-1 flex-col"
        style={{
          paddingBottom: reservedBottom,
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
