import { useEffect, useState } from "react";
import Icon from "./Icon";
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

const MEDAL = ["#f5b50a", "#c4ccd6", "#cd7f3a"];

export default function AnagramLeaderboard({ currentPlayerId }: { currentPlayerId: string | null }) {
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

  const empty = scope === "daily" ? daily.length === 0 : weekly.length === 0;

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
      ) : empty ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="emoji_events" size={36} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No scores yet.</p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Be the first!</p>
        </div>
      ) : (
        <div className="mt-3.5 w-full overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {(scope === "daily" ? daily : weekly).map((e, i, arr) => {
            const you = e.playerId === currentPlayerId;
            const points = scope === "daily" ? (e as DailyEntry).score : (e as WeeklyEntry).totalScore;
            const trail = scope === "daily" ? `${(e as DailyEntry).wordsFound}w` : `${(e as WeeklyEntry).daysPlayed}d`;
            return (
              <div
                key={e.playerId}
                className="flex items-center gap-2.5 px-3.5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none", background: you ? "var(--accent-soft)" : "transparent" }}
              >
                <div className="flex w-6 flex-shrink-0 justify-center">
                  <RankBadge rank={e.rank} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                    {e.name}
                    {you && <span className="ml-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>(You)</span>}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>Block {e.block}, {e.flatNumber}</p>
                </div>
                <span className="one-mono text-[15px] font-bold" style={{ color: "var(--warning)" }}>{points}</span>
                <span className="one-mono w-9 text-right text-[13px]" style={{ color: "var(--text-3)" }}>{trail}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3.5 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-3)" }}>
        <Icon name="info" size={15} style={{ color: "var(--text-3)" }} />
        Points come from words found — pangrams count double.
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
