import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";

type Scope = "daily" | "weekly";

type DailyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  score: number;
  wordsFound: number;
};

type WeeklyEntry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  totalScore: number;
  daysPlayed: number;
};

export default function AnagramLeaderboard({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
  const [scope, setScope] = useState<Scope>("daily");
  const [daily, setDaily] = useState<DailyEntry[]>([]);
  const [weekly, setWeekly] = useState<WeeklyEntry[]>([]);
  const [weekLabel, setWeekLabel] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/anagram/leaderboard?scope=${scope}`)
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

  const empty = scope === "daily" ? daily.length === 0 : weekly.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <Btn active={scope === "daily"} onClick={() => setScope("daily")}>
            Today
          </Btn>
          <Btn active={scope === "weekly"} onClick={() => setScope("weekly")}>
            Weekly
          </Btn>
        </div>
      </div>

      {scope === "weekly" && weekLabel && (
        <p className="-mt-2 text-center text-xs text-slate-500">{weekLabel}</p>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : empty ? (
        <div className="py-10 text-center">
          <Trophy size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No scores yet.</p>
          <p className="mt-1 text-xs text-slate-500">Be the first!</p>
        </div>
      ) : scope === "daily" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          {daily.map((e) => {
            const badge =
              e.rank === 1
                ? "🥇"
                : e.rank === 2
                  ? "🥈"
                  : e.rank === 3
                    ? "🥉"
                    : String(e.rank);
            return (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-slate-700 px-4 py-3 last:border-0",
                  e.playerId === currentPlayerId && "bg-indigo-500/10"
                )}
              >
                <span className="w-6 text-center text-sm font-bold">
                  {badge}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-indigo-400">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Block {e.block}, {e.flatNumber}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-amber-300">
                  {e.score}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {e.wordsFound}w
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
          {weekly.map((e) => {
            const badge =
              e.rank === 1
                ? "🥇"
                : e.rank === 2
                  ? "🥈"
                  : e.rank === 3
                    ? "🥉"
                    : String(e.rank);
            return (
              <div
                key={e.playerId}
                className={clsx(
                  "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-slate-700 px-4 py-3 last:border-0",
                  e.playerId === currentPlayerId && "bg-indigo-500/10"
                )}
              >
                <span className="w-6 text-center text-sm font-bold">
                  {badge}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {e.name}
                    {e.playerId === currentPlayerId && (
                      <span className="ml-1.5 text-xs text-indigo-400">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Block {e.block}, {e.flatNumber}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-amber-300">
                  {e.totalScore}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {e.daysPlayed}d
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Btn({
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
