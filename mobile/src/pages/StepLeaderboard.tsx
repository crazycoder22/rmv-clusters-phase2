import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// Dashboard response shape from /api/events/[id]/dashboard. Already public —
// no auth header needed.
interface Participant {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  totalSteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  averageDailySteps: number;
}

interface DashboardResponse {
  announcement: { title: string; date: string };
  participants: Participant[];
  stepLeaderboard: Participant[];
  totalActualSteps: number;
  onTrackCount: number;
  totalWithGoal: number;
}

// Medal circle styling for the top three (design palette).
const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#f5a623", fg: "#3a2600" },
  2: { bg: "#b9c2cf", fg: "#1a2030" },
  3: { bg: "#d2641f", fg: "#ffffff" },
};

export default function StepLeaderboard() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/events/${id}/dashboard`);
      if (!res.ok) {
        setError("Could not load leaderboard.");
        return;
      }
      setData(await res.json());
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const myRank = useMemo(() => {
    if (!data || !user) return null;
    const idx = data.stepLeaderboard.findIndex(
      (p) => p.name === user.name && p.block === user.block
    );
    return idx >= 0 ? idx + 1 : null;
  }, [data, user]);

  const shown = data?.stepLeaderboard.slice(0, 50) ?? [];

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-start gap-3.5 py-3">
        <Link to={`/steps/${id}`} className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[23px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
            {data?.announcement.title ?? "Leaderboard"}
          </h1>
          <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--text-3)" }}>
            {data?.participants.length ?? 0} participants · {data?.onTrackCount ?? 0} on track
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} />
        </div>
      ) : error ? (
        <p className="rounded-[12px] px-4 py-3 text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          {error}
        </p>
      ) : !data ? null : (
        <>
          {/* Community totals */}
          <div className="flex gap-2.5">
            <SummaryCard ms="military_tech" iconColor="var(--gold)" iconBg="rgba(231,181,61,0.16)" value={data.totalActualSteps.toLocaleString("en-IN")} label="COMMUNITY STEPS" />
            <SummaryCard ms="my_location" iconColor="var(--success)" iconBg="var(--success-soft)" value={String(data.onTrackCount)} label={`ON TRACK / ${data.totalWithGoal}`} />
          </div>

          {myRank && myRank > 10 && (
            <div className="mt-3 rounded-[14px] px-3.5 py-2.5" style={{ background: "var(--accent-soft)", border: "1.5px solid var(--accent)" }}>
              <p className="one-mono text-[10px] font-semibold" style={{ color: "var(--accent)", letterSpacing: "0.12em" }}>YOUR RANK</p>
              <p className="mt-0.5 text-[15px] font-bold" style={{ color: "var(--text)" }}>#{myRank} of {data.stepLeaderboard.length}</p>
            </div>
          )}

          <div className="mb-3 mt-5 flex items-center gap-2" style={{ color: "var(--text-3)" }}>
            <Icon name="emoji_events" size={16} style={{ color: "var(--text-3)" }} />
            <span className="one-mono text-[11px] font-semibold" style={{ letterSpacing: "0.14em" }}>LEADERBOARD</span>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-[16px] px-4 py-8 text-center text-[12px]" style={{ border: "1px dashed var(--border-strong)", color: "var(--text-3)" }}>
              No step entries yet. Be the first to log a day!
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {shown.map((p, i) => {
                const isMe = !!user && p.name === user.name && p.block === user.block;
                const rank = i + 1;
                const medal = MEDAL[rank];
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-[16px] p-3.5"
                    style={
                      isMe
                        ? { background: "var(--accent-soft)", border: "1.5px solid var(--accent)" }
                        : rank === 1
                          ? { background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.55)" }
                          : { background: "var(--surface)", border: "1px solid var(--border)" }
                    }
                  >
                    <span
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold"
                      style={medal ? { background: medal.bg, color: medal.fg } : { background: "var(--surface-3)", color: "var(--text-2)" }}
                    >
                      {rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
                        {p.name}
                        {isMe && <span className="ml-2 rounded-[6px] px-1.5 py-0.5 text-[10px] font-extrabold text-white" style={{ background: "var(--accent-strong)", letterSpacing: "0.06em" }}>YOU</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-3)" }}>
                        B{p.block} · {p.flatNumber} · {p.daysGoalMet}/{p.daysTracked} days met
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[17px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                      {p.totalSteps.toLocaleString("en-IN")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-[13px]" style={{ color: "var(--text-3)" }}>
            <Icon name="group" size={16} style={{ color: "var(--text-3)" }} />
            Showing top {shown.length} of {data.stepLeaderboard.length}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ ms, iconColor, iconBg, value, label }: { ms: string; iconColor: string; iconBg: string; value: string; label: string }) {
  return (
    <div className="flex-1 rounded-[16px] p-[15px_14px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="mb-3.5 flex h-[38px] w-[38px] items-center justify-center rounded-full" style={{ background: iconBg }}>
        <Icon name={ms} size={21} style={{ color: iconColor }} />
      </div>
      <p className="text-[24px] font-extrabold tracking-tight tabular-nums" style={{ color: "var(--text)" }}>{value}</p>
      <p className="one-mono mt-1 text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>{label}</p>
    </div>
  );
}
