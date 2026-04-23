import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import clsx from "clsx";
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
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <ScopeButton active={scope === "daily"} onClick={() => setScope("daily")}>
            Today
          </ScopeButton>
          <ScopeButton active={scope === "weekly"} onClick={() => setScope("weekly")}>
            Weekly
          </ScopeButton>
        </div>
      </div>

      {scope === "weekly" && weekLabel && (
        <p className="-mt-2 text-center text-xs text-slate-500">{weekLabel}</p>
      )}

      <div className="flex justify-center gap-2">
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            onClick={() => onDifficultyChange(d)}
            className={clsx(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              difficulty === d
                ? "border-indigo-500 bg-indigo-500 text-white"
                : "border-slate-700 bg-slate-800 text-slate-400"
            )}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : isEmpty ? (
        <div className="py-10 text-center">
          <Trophy size={40} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">
            {scope === "weekly"
              ? `No completions this week for ${difficulty}!`
              : `No completions yet for ${difficulty}!`}
          </p>
        </div>
      ) : scope === "daily" ? (
        <DailyList entries={daily} currentPlayerId={currentPlayerId} />
      ) : (
        <WeeklyList entries={weekly} currentPlayerId={currentPlayerId} />
      )}
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400"
      )}
    >
      {children}
    </button>
  );
}

function rankBadge(rank: number) {
  const label =
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  return <span className="w-6 text-center text-sm font-bold">{label}</span>;
}

function DailyList({
  entries,
  currentPlayerId,
}: {
  entries: DailyEntry[];
  currentPlayerId: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-2">
        <div className="grid grid-cols-[auto_1fr_auto] gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Time</span>
        </div>
      </div>
      <div className="divide-y divide-slate-700">
        {entries.map((e) => (
          <div
            key={e.playerId}
            className={clsx(
              "grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3",
              e.playerId === currentPlayerId && "bg-indigo-500/10"
            )}
          >
            {rankBadge(e.rank)}
            <div>
              <p className="text-sm font-medium text-slate-100">
                {e.name}
                {e.playerId === currentPlayerId && (
                  <span className="ml-1.5 text-xs text-indigo-400">(You)</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                Block {e.block}, {e.flatNumber}
              </p>
            </div>
            <span className="text-right font-mono text-sm font-semibold text-indigo-300">
              {formatTime(e.timeSeconds)}
            </span>
          </div>
        ))}
      </div>
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
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-2">
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Days</span>
          <span className="text-right">Points</span>
        </div>
      </div>
      <div className="divide-y divide-slate-700">
        {entries.map((e) => (
          <div
            key={e.playerId}
            className={clsx(
              "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3",
              e.playerId === currentPlayerId && "bg-indigo-500/10"
            )}
          >
            {rankBadge(e.rank)}
            <div>
              <p className="text-sm font-medium text-slate-100">
                {e.name}
                {e.playerId === currentPlayerId && (
                  <span className="ml-1.5 text-xs text-indigo-400">(You)</span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                Block {e.block}, {e.flatNumber}
                <span className="mx-1">·</span>
                <span className="font-mono">{formatTime(e.totalTime)}</span> total
              </p>
            </div>
            <span className="text-right font-mono text-xs text-slate-400">
              {e.daysPlayed}/7
            </span>
            <span className="text-right font-mono text-sm font-bold text-amber-300">
              {e.totalPoints}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-700 bg-slate-900/50 px-4 py-2">
        <p className="text-center text-[10px] text-slate-500">
          Daily points: 1st=10 · 2nd=8 · 3rd=6 · 4th=5 · 5th=4 · 6th=3 · 7th=2 ·
          8th+=1
        </p>
      </div>
    </div>
  );
}
