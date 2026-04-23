import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";

type Scope = "alltime" | "weekly";

type Entry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  score: number;
  highestTile: number;
  moves: number;
  duration: number;
  won: boolean;
};

export default function Game2048Leaderboard({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
  const [scope, setScope] = useState<Scope>("alltime");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/2048/leaderboard?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : { leaderboard: [] }))
      .then((data) => {
        if (cancelled) return;
        setEntries(data.leaderboard ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
          <ScopeButton
            active={scope === "alltime"}
            onClick={() => setScope("alltime")}
          >
            All time
          </ScopeButton>
          <ScopeButton
            active={scope === "weekly"}
            onClick={() => setScope("weekly")}
          >
            Last 7 days
          </ScopeButton>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center">
          <Trophy size={40} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No runs recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
          <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-2">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Score</span>
              <span className="text-right">Best tile</span>
            </div>
          </div>
          <div className="divide-y divide-slate-700">
            {entries.map((e) => {
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
                    "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3",
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
                      {e.won && (
                        <span className="ml-1.5 text-xs text-amber-300">
                          🏆
                        </span>
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
                  <span className="text-right font-mono text-sm font-semibold text-indigo-300">
                    {e.highestTile}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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
