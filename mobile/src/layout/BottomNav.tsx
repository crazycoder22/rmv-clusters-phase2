import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Icon from "../components/Icon";

// On Android 15/16 with Samsung One UI, the WebView draws under the system
// gesture / 3-button nav bar even with WindowCompat.setDecorFitsSystemWindows
// flipped in MainActivity — Capacitor's WebView setup runs after onCreate and
// re-enables edge-to-edge in practice. env(safe-area-inset-bottom) reports
// zero in that configuration, so the BottomNav lands on top of the system
// nav. Add an explicit fallback only on Android: 48px clears the standard
// 3-button nav height on every Samsung device we've tested. iOS keeps the
// pure env() value because the safe-area inset is honoured there.
const ANDROID_NAV_BAR_FALLBACK_PX = 48;
const bottomPadding =
  Capacitor.getPlatform() === "android"
    ? `calc(env(safe-area-inset-bottom, 0px) + ${ANDROID_NAV_BAR_FALLBACK_PX}px)`
    : "env(safe-area-inset-bottom, 0px)";

// OneRMV nav: Home · Community · Settings. Home is the dashboard only; Settings
// owns the preferences screen; Community owns the hub + every feature launched
// from it (so any non-home, non-settings route keeps the Community tab lit).
function isSettingsActive(p: string): boolean {
  return p.startsWith("/settings");
}
function isHomeActive(p: string): boolean {
  return p === "/";
}
function isCommunityActive(p: string): boolean {
  return !isHomeActive(p) && !isSettingsActive(p);
}

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40"
      style={{
        paddingBottom: bottomPadding,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <Tab to="/" label="Home" ms="home" active={isHomeActive(pathname)} />
        <Tab
          to="/community"
          label="Community"
          ms="forum"
          active={isCommunityActive(pathname)}
        />
        <Tab
          to="/settings"
          label="Settings"
          ms="settings"
          active={isSettingsActive(pathname)}
        />
      </div>
    </nav>
  );
}

function Tab({
  to,
  label,
  ms,
  active,
}: {
  to: string;
  label: string;
  ms: string;
  active: boolean;
}) {
  const color = active ? "var(--accent)" : "var(--text-3)";
  return (
    <Link
      to={to}
      className="flex flex-1 flex-col items-center gap-1 py-3"
      style={{ color }}
    >
      <Icon name={ms} size={25} fill={active} weight={active ? 500 : 400} style={{ color }} />
      <span className="text-[11px]" style={{ fontWeight: active ? 700 : 600 }}>
        {label}
      </span>
    </Link>
  );
}
