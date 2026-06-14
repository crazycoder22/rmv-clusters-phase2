import { useEffect, useState } from "react";
import Icon from "./Icon";
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

const MEDAL = ["#f5b50a", "#c4ccd6", "#cd7f3a"];

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
    <div className="flex flex-col items-center">
      {/* All time / Last 7 days */}
      <div
        className="flex rounded-[12px] p-1"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {([["alltime", "All time"], ["weekly", "Last 7 days"]] as const).map(([key, label]) => {
          const on = scope === key;
          return (
            <button
              key={key}
              onClick={() => setScope(key)}
              className="rounded-[9px] px-[20px] py-[7px] text-[13.5px] font-bold transition-colors"
              style={on ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" } : { background: "transparent", color: "var(--text-3)" }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="py-8 text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="emoji_events" size={36} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No runs recorded yet.</p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first!</p>
        </div>
      ) : (
        <div className="mt-3.5 w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {/* column header */}
          <div
            className="grid grid-cols-[28px_1fr_58px_58px] items-center gap-2.5 px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)" }}
          >
            <span className="text-center">#</span>
            <span>Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Best tile</span>
          </div>
          {entries.map((e, i, arr) => {
            const you = e.playerId === currentPlayerId;
            return (
              <div
                key={e.playerId}
                className="grid grid-cols-[28px_1fr_58px_58px] items-center gap-2.5 px-3.5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: you ? "var(--accent-soft)" : "transparent" }}
              >
                <div className="flex justify-center">
                  <RankBadge rank={e.rank} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                    {e.name}
                    {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
                    {e.won && <span className="ml-1.5 text-[12px]" style={{ color: "var(--star)" }}>🏆</span>}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}</p>
                </div>
                <span className="one-mono text-right text-[15px] font-bold" style={{ color: "var(--success)" }}>{e.score}</span>
                <span className="one-mono text-right text-[14px] font-semibold" style={{ color: "var(--accent)" }}>{e.highestTile}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
        <Icon name="info" size={15} style={{ color: "var(--text-3)" }} />
        Ranked by highest single-game score this period.
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
