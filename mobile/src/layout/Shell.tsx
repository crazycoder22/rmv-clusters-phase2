import { type ReactNode } from "react";
import BottomNav from "./BottomNav";

// Wraps the routed content with a fixed bottom navigation bar. The reserved
// space below the main area ≈ 52px tab height + 10px breathing room + device
// safe-area inset; BottomNav itself adds the safe-area padding internally.
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main
        className="flex flex-1 flex-col"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 62px)",
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
