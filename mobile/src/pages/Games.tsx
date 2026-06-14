import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Cat = "solo" | "live" | "both";
type Tag = "daily" | "live" | "2p" | "multi";

interface Game {
  to: string;
  ms: string; // Material Symbol
  title: string;
  subtitle: string;
  cat: Cat;
  tags: Tag[];
  meta?: string;
  metaIcon?: string;
}

// Community games (OneRMV Games.dc.html). Metas are static + truthful — the
// design's live counts / "best score" are mockups with no backend.
const GAMES: Game[] = [
  { to: "/memory", ms: "dashboard", title: "Memory Match", subtitle: "Daily 5×4 card challenge", cat: "both", tags: ["daily", "2p"], meta: "Multiplayer inside", metaIcon: "group" },
  { to: "/wordle", ms: "abc", title: "Wordle", subtitle: "Guess the 5-letter word", cat: "solo", tags: ["daily"], meta: "Resets at midnight", metaIcon: "schedule" },
  { to: "/anagram", ms: "spellcheck", title: "Anagram", subtitle: "Find words from 7 letters", cat: "solo", tags: ["daily"], meta: "Resets at midnight", metaIcon: "schedule" },
  { to: "/sudoku", ms: "grid_3x3", title: "Sudoku", subtitle: "Daily 9×9 number puzzle", cat: "solo", tags: [], meta: "3 difficulty levels", metaIcon: "tune" },
  { to: "/2048", ms: "grid_4x4", title: "2048", subtitle: "Swipe to merge the tiles", cat: "solo", tags: [] },
  { to: "/quiz", ms: "quiz", title: "Quiz Night", subtitle: "Join the live community quiz", cat: "live", tags: ["live"], meta: "Join with a code", metaIcon: "vpn_key" },
  { to: "/tambola", ms: "casino", title: "Tambola", subtitle: "Live bingo with prizes", cat: "live", tags: ["live"], meta: "Join with a code", metaIcon: "vpn_key" },
  { to: "/fantasy", ms: "sports_cricket", title: "Fantasy Cricket", subtitle: "Pick your XI for match day", cat: "live", tags: ["multi"], meta: "Match-day lineups", metaIcon: "sports_cricket" },
];

const TABS = [
  { key: "all", label: "All games" },
  { key: "solo", label: "Solo play" },
  { key: "live", label: "Play together" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function Games() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [coins, setCoins] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("all");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch("/api/medals/me", { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setCoins(d.totalCoins ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  const games = useMemo(
    () => GAMES.filter((g) => (tab === "all" ? true : tab === "solo" ? g.cat === "solo" || g.cat === "both" : g.cat === "live" || g.cat === "both")),
    [tab]
  );
  const sectionLabel = TABS.find((t) => t.key === tab)!.label;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-start gap-3 py-2">
        <button onClick={() => navigate(-1)} className="mt-1 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[25px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Games</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--text-2)" }}>Community games — play solo or together.</p>
        </div>
        {coins !== null && (
          <Link
            to="/rewards"
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-80"
            style={{ background: "var(--warning-soft)" }}
          >
            <Icon name="paid" size={17} fill style={{ color: "var(--warning)" }} />
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--warning)" }}>{coins.toLocaleString("en-IN")}</span>
          </Link>
        )}
      </header>

      {/* Segmented filter */}
      <div className="mb-3 mt-1 flex rounded-[13px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 text-[14px] font-bold transition-colors"
              style={on ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
            >
              {t.key === "live" && <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--success)" }} />}
              {t.key === "all" ? "All" : t.key === "solo" ? "Solo" : "Live"}
            </button>
          );
        })}
      </div>

      {/* Section label */}
      <div className="flex items-center justify-between px-0.5 pb-2">
        <span className="one-mono text-[10px] font-semibold uppercase" style={{ color: "var(--text-3)", letterSpacing: "0.14em" }}>{sectionLabel}</span>
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>{games.length} game{games.length === 1 ? "" : "s"}</span>
      </div>

      {/* Game rows */}
      <div className="flex flex-col gap-3">
        {games.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className="flex items-center gap-3 rounded-[18px] p-3.5 active:opacity-90"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]" style={{ background: "var(--accent-soft)" }}>
              <Icon name={g.ms} size={25} weight={500} style={{ color: "var(--accent)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{g.title}</span>
                {g.tags.map((t) => <TagPill key={t} tag={t} />)}
              </div>
              <div className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-2)" }}>{g.subtitle}</div>
              {g.meta && (
                <div className="mt-1 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
                  <Icon name={g.metaIcon ?? "info"} size={14} style={{ color: "var(--text-3)" }} />
                  {g.meta}
                </div>
              )}
            </div>
            <Icon name="chevron_right" size={20} className="flex-shrink-0" style={{ color: "var(--text-3)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  if (tag === "live") {
    return (
      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
        <span className="h-[5px] w-[5px] rounded-full" style={{ background: "var(--success)" }} />Live
      </span>
    );
  }
  if (tag === "daily") {
    return <span className="flex-shrink-0 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Daily</span>;
  }
  const label = tag === "2p" ? "2P" : "Team";
  return <span className="flex-shrink-0 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>{label}</span>;
}
