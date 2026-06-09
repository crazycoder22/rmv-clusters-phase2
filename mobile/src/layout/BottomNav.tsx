import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Home, MoreHorizontal, Newspaper } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import clsx from "clsx";

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

const GAMES_PREFIXES = [
  "/games",
  "/memory",
  "/wordle",
  "/sudoku",
  "/2048",
  "/quiz",
  "/tambola",
  "/fantasy",
  "/anagram",
];

const MORE_PREFIXES = [
  "/more",
  "/guidelines",
  "/info",
  "/faq",
  "/gallery",
  "/videos",
  "/sos-guidelines",
  "/sos-warriors",
  "/residents",
  "/settings",
  "/marketplace",
  "/domestic-help",
  "/admin",
  "/issues",
  "/community",
  "/polls",
  "/visits",
  "/vehicles",
];

function isGamesActive(pathname: string): boolean {
  return GAMES_PREFIXES.some((p) => pathname.startsWith(p));
}

function isNewsActive(pathname: string): boolean {
  return pathname.startsWith("/news");
}

function isMoreActive(pathname: string): boolean {
  return MORE_PREFIXES.some((p) => pathname.startsWith(p));
}

function isHomeActive(pathname: string): boolean {
  return (
    pathname === "/" ||
    (!isGamesActive(pathname) &&
      !isNewsActive(pathname) &&
      !isMoreActive(pathname))
  );
}

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
      style={{ paddingBottom: bottomPadding }}
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <Tab
          to="/"
          label="Home"
          Icon={Home}
          active={isHomeActive(pathname)}
        />
        <Tab
          to="/games"
          label="Games"
          Icon={Gamepad2}
          active={isGamesActive(pathname)}
        />
        <Tab
          to="/news"
          label="News"
          Icon={Newspaper}
          active={isNewsActive(pathname)}
        />
        <Tab
          to="/more"
          label="More"
          Icon={MoreHorizontal}
          active={isMoreActive(pathname)}
        />
      </div>
    </nav>
  );
}

function Tab({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
        active ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
      )}
    >
      <Icon size={20} />
      {label}
    </Link>
  );
}
