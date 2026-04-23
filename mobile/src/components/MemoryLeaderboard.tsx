import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import clsx from "clsx";
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

export default function MemoryLeaderboard({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
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
  }, [scope]);

  const isEmpty =
    scope === "daily" ? daily.length === 0 : weekly.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <ScopeButton active={scope === "daily"} onClick={() => setScope("daily")}>
            Today
          </ScopeButton>
          <ScopeButton
            active={scope === "weekly"}
            onClick={() => setScope("weekly")}
          >
            Weekly
          </ScopeButton>
        </div>
      </div>

      {scope === "weekly" && weekLabel && (
        <p className="-mt-2 text-center text-xs text-slate-500">{weekLabel}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : isEmpty ? (
        <div className="py-10 text-center">
          <Trophy size={40} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">
            {scope === "weekly"
              ? "No completions this week yet!"
              : "No completions today yet!"}
          </p>
          <p className="mt-1 text-xs text-slate-500">Be the first!</p>
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
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Moves</span>
          <span className="text-right">Time</span>
        </div>
      </div>
      <div className="divide-y divide-slate-700">
        {entries.map((e) => (
          <div
            key={e.playerId}
            className={clsx(
              "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-3",
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
                Block {e.block}
                {e.flatNumber ? `, ${e.flatNumber}` : ""}
              </p>
            </div>
            <span className="text-right font-mono text-sm font-bold text-green-400">
              {e.score}
            </span>
            <span className="text-right font-mono text-sm font-semibold text-slate-300">
              {e.moves}
            </span>
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
          <span className="text-right">Points</span>
          <span className="text-right">Days</span>
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
                Block {e.block}
                {e.flatNumber ? `, ${e.flatNumber}` : ""}
              </p>
            </div>
            <span className="text-right font-mono text-sm font-bold text-green-400">
              {e.totalScore}
            </span>
            <span className="text-right font-mono text-sm text-slate-400">
              {e.daysPlayed}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
