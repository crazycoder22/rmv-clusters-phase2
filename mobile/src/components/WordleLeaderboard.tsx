import { useEffect, useState } from "react";
import Icon from "./Icon";
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

const MEDAL = ["#f5b50a", "#c4ccd6", "#cd7f3a"];

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
    return <p className="py-8 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Icon name="emoji_events" size={36} style={{ color: "var(--text-3)" }} />
        <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No games yet.</p>
        <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div
          className="grid grid-cols-[24px_1fr_46px_50px_36px] items-center gap-2.5 px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-wider"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)" }}
        >
          <span className="text-center">#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Avg</span>
        </div>
        {entries.map((e, i, arr) => {
          const you = e.id === currentPlayerId;
          return (
            <div
              key={e.id}
              className="grid grid-cols-[24px_1fr_46px_50px_36px] items-center gap-2.5 px-3.5 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: you ? "var(--accent-soft)" : "transparent" }}
            >
              <div className="flex justify-center">
                <RankBadge rank={i + 1} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-bold" style={{ color: "var(--text)" }}>
                  {e.name}
                  {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
                </p>
                <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}</p>
              </div>
              <span className="one-mono text-right text-[15px] font-bold" style={{ color: "var(--success)" }}>{e.totalScore}</span>
              <span className="one-mono text-right text-[14px] font-bold" style={{ color: "var(--text)" }}>{e.totalWins}/{e.totalPlayed}</span>
              <span className="one-mono text-right text-[14px] font-semibold" style={{ color: "var(--text-3)" }}>{e.avgAttempts || "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
        <Icon name="info" size={15} style={{ color: "var(--text-3)" }} />
        Score rewards solving in fewer guesses. AVG = mean guesses per win.
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
