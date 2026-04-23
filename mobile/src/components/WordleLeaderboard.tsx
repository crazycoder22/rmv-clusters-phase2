import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";

type Entry = {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  totalWins: number;
  totalPlayed: number;
  totalScore: number;
  avgAttempts: number;
};

export default function WordleLeaderboard({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/wordle/leaderboard")
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
  }, []);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        <Trophy size={40} className="mx-auto mb-2 text-slate-600" />
        <p className="text-sm text-slate-400">No games yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      <div className="border-b border-slate-700 bg-slate-900/50 px-4 py-2">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Avg</span>
        </div>
      </div>
      <div className="divide-y divide-slate-700">
        {entries.map((e, i) => {
          const rank = i + 1;
          const badge =
            rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
          return (
            <div
              key={e.id}
              className={clsx(
                "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 px-4 py-3",
                e.id === currentPlayerId && "bg-indigo-500/10"
              )}
            >
              <span className="w-6 text-center text-sm font-bold">{badge}</span>
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {e.name}
                  {e.id === currentPlayerId && (
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
              <span className="text-right font-mono text-sm font-semibold text-slate-300">
                {e.totalWins}/{e.totalPlayed}
              </span>
              <span className="text-right font-mono text-sm text-slate-400">
                {e.avgAttempts || "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
