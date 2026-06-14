import { useEffect, useState } from "react";
import Icon from "./Icon";
import { type Difficulty, formatTime } from "../lib/sudoku";
import { apiFetch } from "../lib/api";

type Scope = "daily" | "weekly";

type DailyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  timeSeconds: number;
};

type WeeklyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalPoints: number;
  totalTime: number;
  daysPlayed: number;
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const MEDAL = ["#f5b50a", "#c4ccd6", "#cd7f3a"];

export default function SudokuLeaderboard({
  currentPlayerId,
  difficulty,
  onDifficultyChange,
}: {
  currentPlayerId: string | null;
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
}) {
  const [scope, setScope] = useState<Scope>("daily");
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url = `/api/sudoku/leaderboard?scope=${scope}&difficulty=${difficulty}`;
    apiFetch(url)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((data) => {
        if (cancelled) return;
        if (scope === "weekly") {
          setWeekly(data.leaderboard ?? []);
          if (data.weekStart && data.weekEnd) {
            const fmt = (s: string) =>
              new Date(s + "T00:00:00+05:30").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              });
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
  }, [difficulty, scope]);

  const isEmpty = scope === "daily" ? daily.length === 0 : weekly.length === 0;

  return (
    <div className="flex flex-col items-center">
      {/* Today / Weekly */}
      <div
        className="flex rounded-[12px] p-1"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
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

      {/* difficulty filter */}
      <div className="mt-3.5 flex gap-2.5">
        {DIFFICULTIES.map((d) => {
          const on = difficulty === d;
          return (
            <button
              key={d}
              onClick={() => onDifficultyChange(d)}
              className="rounded-full px-[18px] py-2 text-[13.5px] font-bold transition-colors"
              style={on ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 2px 10px rgba(99,102,241,0.4)" } : { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-8 text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="emoji_events" size={36} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>
            {scope === "weekly"
              ? `No completions this week for ${difficulty}.`
              : `No completions yet for ${difficulty}.`}
          </p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first!</p>
        </div>
      ) : scope === "daily" ? (
        <DailyList entries={daily} currentPlayerId={currentPlayerId} />
      ) : (
        <WeeklyList entries={weekly} currentPlayerId={currentPlayerId} />
      )}
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

function DailyList({
  entries,
  currentPlayerId,
}: {
  entries: DailyEntry[];
  currentPlayerId: string | null;
}) {
  return (
    <div className="mt-3.5 w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div
        className="grid grid-cols-[28px_1fr_64px] items-center gap-2.5 px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        <span className="text-center">#</span>
        <span>Player</span>
        <span className="text-right">Time</span>
      </div>
      {entries.map((e, i, arr) => {
        const you = e.playerId === currentPlayerId;
        return (
          <div
            key={e.playerId}
            className="grid grid-cols-[28px_1fr_64px] items-center gap-2.5 px-3.5 py-3"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: you ? "var(--accent-soft)" : "transparent" }}
          >
            <div className="flex justify-center">
              <RankBadge rank={e.rank} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                {e.name}
                {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>Block {e.block}, {e.flatNumber}</p>
            </div>
            <span className="one-mono text-right text-[15px] font-bold" style={{ color: "var(--accent)" }}>{formatTime(e.timeSeconds)}</span>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyList({
  entries,
  currentPlayerId,
}: {
  entries: WeeklyEntry[];
  currentPlayerId: string | null;
}) {
  return (
    <div className="mt-3.5 w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div
        className="grid grid-cols-[28px_1fr_44px_50px] items-center gap-2.5 px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)" }}
      >
        <span className="text-center">#</span>
        <span>Player</span>
        <span className="text-right">Days</span>
        <span className="text-right">Points</span>
      </div>
      {entries.map((e, i, arr) => {
        const you = e.playerId === currentPlayerId;
        return (
          <div
            key={e.playerId}
            className="grid grid-cols-[28px_1fr_44px_50px] items-center gap-2.5 px-3.5 py-3"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: you ? "var(--accent-soft)" : "transparent" }}
          >
            <div className="flex justify-center">
              <RankBadge rank={e.rank} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                {e.name}
                {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
              </p>
              <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>
                Block {e.block}, {e.flatNumber} · <span className="one-mono">{formatTime(e.totalTime)}</span> total
              </p>
            </div>
            <span className="one-mono text-right text-[14px] font-semibold" style={{ color: "var(--text-2)" }}>{e.daysPlayed}/7</span>
            <span className="one-mono text-right text-[16px] font-bold" style={{ color: "var(--warning)" }}>{e.totalPoints}</span>
          </div>
        );
      })}
      <div className="px-3.5 py-3 text-[11px] leading-snug" style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)" }}>
        Daily points: 1st=10 · 2nd=8 · 3rd=6 · 4th=5 · 5th=4 · 6th=3 · 7th=2 · 8th+=1
      </div>
    </div>
  );
}
