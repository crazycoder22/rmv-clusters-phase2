import { useEffect, useState } from "react";
import Icon from "./Icon";
import { apiFetch } from "../lib/api";

type Entry = {
  rank: number;
  playerId: string;
  name: string;
  block: number;
  flatNumber: string;
  timeSeconds: number;
  date: string;
};

const MEDAL_BG = ["var(--cw-gold)", "var(--cw-silver)", "var(--cw-bronze)"];
const MEDAL_FG = ["#3a2600", "#1a2030", "#ffffff"];

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function CrosswordLeaderboard({
  currentPlayerId,
}: {
  currentPlayerId: string | null;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/crossword/leaderboard")
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
        <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No solves yet today.</p>
        <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first to finish!</p>
      </div>
    );
  }

  return (
    <div className="px-0.5">
      <div className="overflow-hidden rounded-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div
          className="grid items-center px-[18px] py-3.5 one-mono text-[11px] uppercase"
          style={{ gridTemplateColumns: "44px 1fr auto", letterSpacing: "0.12em", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}
        >
          <div>#</div>
          <div>Player</div>
          <div className="text-right">Time</div>
        </div>

        {/* Rows */}
        {entries.map((e, i) => {
          const you = e.playerId === currentPlayerId;
          return (
            <div
              key={e.playerId}
              className="grid items-center gap-1.5 px-[18px] py-4"
              style={{
                gridTemplateColumns: "44px 1fr auto",
                borderTop: i > 0 ? "1px solid var(--border)" : "none",
                background: you ? "var(--accent-soft)" : "transparent",
              }}
            >
              <RankBadge rank={i + 1} />
              <div className="min-w-0">
                <div className="truncate text-[17px] font-bold" style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
                  {e.name}
                  {you && <span className="ml-1.5 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
                </div>
                <div className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-3)" }}>
                  Block {e.block}{e.flatNumber ? `, ${e.flatNumber}` : ""}
                </div>
              </div>
              <div className="one-mono text-right text-[19px] font-bold" style={{ color: "var(--success)", letterSpacing: "0.04em" }}>
                {formatTime(e.timeSeconds)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div className="mt-4 flex items-start gap-2.5 px-1">
        <Icon name="info" size={17} style={{ color: "var(--text-3)" }} />
        <span className="text-[13px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Fastest solves of today's puzzle. New puzzle at midnight IST.
        </span>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[14px] font-extrabold"
        style={{ background: MEDAL_BG[rank - 1], color: MEDAL_FG[rank - 1] }}
      >
        {rank}
      </div>
    );
  }
  return <div className="one-mono text-[15px] font-semibold" style={{ color: "var(--text-2)" }}>{rank}</div>;
}
