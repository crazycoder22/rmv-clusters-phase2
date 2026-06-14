import { useEffect, useState } from "react";
import Icon from "./Icon";
import { ACTIVE_DIFFICULTY, formatTime } from "../lib/memory";
import { apiFetch } from "../lib/api";

type Scope = "daily" | "weekly";

type DailyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  moves: number;
  timeSeconds: number;
  score: number;
};

type WeeklyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalScore: number;
  totalTime: number;
  daysPlayed: number;
};

const MEDAL = ["#f5b50a", "#c4ccd6", "#cd7f3a"];

export default function MemoryLeaderboard({ currentPlayerId }: { currentPlayerId: string | null }) {
  const [scope, setScope] = useState<Scope>("weekly");
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = `/api/memory/leaderboard?scope=${scope}&difficulty=${ACTIVE_DIFFICULTY}`;
    apiFetch(url)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((data) => {
        if (cancelled) return;
        if (scope === "weekly") {
          setWeekly(data.leaderboard ?? []);
          if (data.weekStart && data.weekEnd) {
            const fmt = (s: string) =>
              new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            setWeekLabel(`${fmt(data.weekStart)} – ${fmt(data.weekEnd)}`);
          }
        } else {
          setDaily(data.leaderboard ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const isEmpty = scope === "daily" ? daily.length === 0 : weekly.length === 0;

  return (
    <div className="flex flex-col items-center">
      {/* Today / Weekly */}
      <div className="flex rounded-[12px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {([["daily", "Today"], ["weekly", "Weekly"]] as const).map(([key, label]) => {
          const on = scope === key;
          return (
            <button
              key={key}
              onClick={() => setScope(key)}
              className="rounded-[9px] px-[22px] py-[7px] text-[13.5px] font-bold transition-colors"
              style={on ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {scope === "weekly" && weekLabel && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--text-3)" }}>{weekLabel}</p>
      )}

      {loading ? (
        <p className="py-8 text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="emoji_events" size={40} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>
            {scope === "weekly" ? "No completions this week yet!" : "No completions today yet!"}
          </p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first!</p>
        </div>
      ) : (
        <div className="mt-3.5 w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* header */}
          <div className="flex items-center gap-2.5 px-3.5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="one-mono w-6 text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>#</span>
            <span className="one-mono flex-1 text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>PLAYER</span>
            {scope === "daily" ? (
              <>
                <span className="one-mono w-12 text-right text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>SCORE</span>
                <span className="one-mono w-10 text-right text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>MOVES</span>
                <span className="one-mono w-12 text-right text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>TIME</span>
              </>
            ) : (
              <>
                <span className="one-mono w-14 text-right text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>POINTS</span>
                <span className="one-mono w-9 text-right text-[11px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>DAYS</span>
              </>
            )}
          </div>
          {/* rows */}
          {(scope === "daily" ? daily : weekly).map((e, i, arr) => {
            const you = e.playerId === currentPlayerId;
            return (
              <div
                key={e.playerId}
                className="flex items-center gap-2.5 px-3.5 py-3"
                style={{
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  background: you ? "var(--accent-soft)" : "transparent",
                }}
              >
                <div className="flex w-6 flex-shrink-0 justify-center">
                  <RankBadge rank={e.rank} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                    {e.name}
                    {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>
                    Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}
                  </p>
                </div>
                {scope === "daily" ? (
                  <>
                    <span className="one-mono w-12 text-right text-[15px] font-bold" style={{ color: "var(--success)" }}>{(e as DailyEntry).score}</span>
                    <span className="one-mono w-10 text-right text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>{(e as DailyEntry).moves}</span>
                    <span className="one-mono w-12 text-right text-[14px] font-semibold" style={{ color: "var(--accent)" }}>{formatTime((e as DailyEntry).timeSeconds)}</span>
                  </>
                ) : (
                  <>
                    <span className="one-mono w-14 text-right text-[15px] font-bold" style={{ color: "var(--success)" }}>{(e as WeeklyEntry).totalScore}</span>
                    <span className="w-9 text-right text-[14px]" style={{ color: "var(--text-2)" }}>{(e as WeeklyEntry).daysPlayed}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
        <Icon name="info" size={15} style={{ color: "var(--text-3)" }} />
        Points carry over from every daily streak you complete.
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className="one-mono flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-bold"
        style={{ background: MEDAL[rank - 1], color: "#1a1206" }}
      >
        {rank}
      </span>
    );
  }
  return <span className="one-mono text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>{rank}</span>;
}
