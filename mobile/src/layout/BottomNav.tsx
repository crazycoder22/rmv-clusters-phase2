import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Home, MoreHorizontal, Newspaper } from "lucide-react";
import clsx from "clsx";

const GAMES_PREFIXES = [
  "/games",
  "/memory",
  "/wordle",
  "/sudoku",
  "/2048",
  "/quiz",
  "/tambola",
  "/fantasy",
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
  "/issues",
  "/community",
  "/polls",
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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
        active ? "text-indigo-400" : "text-slate-500"
      )}
    >
      <Icon size={20} />
      {label}
    </Link>
  );
}
