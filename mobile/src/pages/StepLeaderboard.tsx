import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Loader2,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
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

  // Find my row to highlight it + show my rank even if I'm below the top N.
  const myRank = useMemo(() => {
    if (!data || !user) return null;
    const idx = data.stepLeaderboard.findIndex(
      (p) => p.name === user.name && p.block === user.block
    );
    return idx >= 0 ? idx + 1 : null;
  }, [data, user]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to={`/steps/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {data?.announcement.title ?? "Leaderboard"}
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {data?.participants.length ?? 0} participants ·{" "}
            {data?.onTrackCount ?? 0} on track
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : error ? (
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      ) : !data ? null : (
        <>
          {/* Community totals */}
          <section className="mb-3 grid grid-cols-2 gap-2">
            <Stat
              value={data.totalActualSteps}
              label="community steps"
              icon={Award}
              tint="bg-amber-500/15 text-amber-200"
            />
            <Stat
              value={data.onTrackCount}
              label={`on track / ${data.totalWithGoal}`}
              icon={Target}
              tint="bg-emerald-500/15 text-emerald-200"
            />
          </section>

          {/* My rank floating card (only if I'm in the list but not in top 10) */}
          {myRank && myRank > 10 && (
            <section className="mb-3 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-indigo-200">
                Your rank
              </p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                #{myRank} of {data.stepLeaderboard.length}
              </p>
            </section>
          )}

          <section className="flex-1 pb-4">
            <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Trophy size={11} /> Leaderboard
            </h2>
            {data.stepLeaderboard.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-[11px] text-slate-500">
                No step entries yet. Be the first to log a day!
              </p>
            ) : (
              <ol className="space-y-1.5">
                {data.stepLeaderboard.slice(0, 50).map((p, i) => {
                  const isMe =
                    user && p.name === user.name && p.block === user.block;
                  const rank = i + 1;
                  return (
                    <li
                      key={p.id}
                      className={clsx(
                        "flex items-center gap-2 rounded-xl border px-3 py-2",
                        isMe
                          ? "border-indigo-500/60 bg-indigo-500/10"
                          : rank === 1
                            ? "border-amber-700/40 bg-amber-900/10"
                            : "border-slate-700 bg-slate-800/60"
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                          rank === 1
                            ? "bg-amber-500 text-white"
                            : rank === 2
                              ? "bg-slate-400 text-white"
                              : rank === 3
                                ? "bg-amber-700 text-white"
                                : "bg-slate-800 text-slate-300"
                        )}
                      >
                        {rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {p.name}
                          {isMe && (
                            <span className="ml-1 rounded-full bg-indigo-500/30 px-1.5 py-0 text-[9px] uppercase text-indigo-200">
                              you
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          B{p.block} · {p.flatNumber} ·{" "}
                          {p.daysGoalMet}/{p.daysTracked} days met
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-white">
                        {p.totalSteps.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <p className="pb-2 text-center text-[10px] text-slate-500">
            <Users size={9} className="-mt-0.5 mr-0.5 inline" />
            Showing top {Math.min(50, data.stepLeaderboard.length)} of{" "}
            {data.stepLeaderboard.length}
          </p>
        </>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  icon: Icon,
  tint,
}: {
  value: number;
  label: string;
  icon: typeof Award;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <div
        className={clsx(
          "mb-1 flex h-7 w-7 items-center justify-center rounded-full",
          tint
        )}
      >
        <Icon size={14} />
      </div>
      <p className="text-lg font-bold leading-tight tabular-nums text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}
