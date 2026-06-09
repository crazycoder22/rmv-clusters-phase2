import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Check,
  Heart,
  Loader2,
  Pencil,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import MyChallengeMobile from "../components/MyChallengeMobile";
import {
  isHealthKitAvailable,
  syncStepsFromHealth,
  type SyncOutcome,
} from "../lib/healthkit";

// ── Types ──────────────────────────────────────────────────────────────────

interface StepEvent {
  rsvpId: string;
  eventConfigId: string;
  announcementId: string;
  title: string;
  summary: string;
  emoji: string | null;
  startDate: string;
  endDate: string;
  dailyGoalString: string;
  dailyGoal: number;
  rsvpCreatedAt: string;
}

interface DashboardParticipant {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
  totalSteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  averageDailySteps: number;
  dailySteps: { date: string; steps: number }[];
}

interface DashboardResponse {
  announcement: { id: string; title: string; date: string; summary: string };
  participants: DashboardParticipant[];
  stepLeaderboard: DashboardParticipant[];
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function StepEventDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<StepEvent | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/step-events", { token });
      if (!res.ok) {
        setError(res.status === 401 ? "Sign in required" : "Could not load");
        return;
      }
      const data = await res.json();
      const match = (data.events as StepEvent[]).find(
        (e) => e.announcementId === id
      );
      if (!match) {
        setError("You aren't registered for this step event.");
        return;
      }
      setEvent(match);
    } catch {
      setError("Network error");
    }
  }, [id, token]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/events/${id}/dashboard`);
      if (!res.ok) return;
      const data = (await res.json()) as DashboardResponse;
      setDashboard(data);
    } catch {
      /* swallow — dashboard is decorative, my-event POST is the source of truth */
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await Promise.all([fetchEvent(), fetchDashboard()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchEvent, fetchDashboard]);

  useEffect(() => {
    void isHealthKitAvailable().then(setHealthAvailable);
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────

  const me = useMemo(
    () =>
      dashboard?.participants.find(
        (p) => p.name === user?.name && p.block === user?.block
      ) ?? null,
    [dashboard, user]
  );

  const days = useMemo(() => {
    if (!event) return [];
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const arr: { date: string; iso: string; isPast: boolean; isToday: boolean }[] = [];
    const today = todayIso();
    for (
      let d = new Date(start);
      d.getTime() < end.getTime();
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const iso = d.toISOString().slice(0, 10);
      arr.push({
        date: d.toISOString(),
        iso,
        isPast: iso < today,
        isToday: iso === today,
      });
    }
    return arr;
  }, [event]);

  const myDailyMap = useMemo(() => {
    const m = new Map<string, number>();
    if (me) {
      for (const d of me.dailySteps) {
        m.set(new Date(d.date).toISOString().slice(0, 10), d.steps);
      }
    }
    return m;
  }, [me]);

  const todaySteps = myDailyMap.get(todayIso()) ?? 0;
  const goal = event?.dailyGoal ?? 0;
  const goalProgress = goal > 0 ? Math.min(100, Math.round((todaySteps / goal) * 100)) : 0;
  const daysElapsed = days.filter((d) => d.isPast || d.isToday).length;
  const daysGoalMet = me?.daysGoalMet ?? 0;
  const totalSteps = me?.totalSteps ?? 0;

  // ── Actions ─────────────────────────────────────────────────────────────

  async function doSync(force: boolean) {
    if (!event) return;
    setSyncing(true);
    setSyncMsg(null);
    const startISO = new Date(
      Math.max(
        new Date(event.startDate).getTime(),
        new Date(event.rsvpCreatedAt).getTime()
      )
    ).toISOString();
    const endISO = new Date().toISOString();
    const out: SyncOutcome = await syncStepsFromHealth(
      { eventId: event.announcementId, startISO, endISO, token },
      { force }
    );
    if (out.ok) {
      setSyncMsg(
        out.saved > 0
          ? `Synced ${out.saved} day${out.saved !== 1 ? "s" : ""} from Apple Health.`
          : "Up to date."
      );
      await fetchDashboard();
    } else {
      setSyncMsg(messageFor(out.reason));
    }
    setSyncing(false);
  }

  async function saveManualSteps(dateIso: string, steps: number) {
    if (!event) return false;
    if (!Number.isFinite(steps) || steps < 0) return false;
    try {
      const res = await apiFetch(`/api/events/${event.announcementId}/my-steps`, {
        method: "POST",
        token,
        body: JSON.stringify({
          entries: [{ date: dateIso, steps }],
        }),
      });
      if (!res.ok) return false;
      await fetchDashboard();
      return true;
    } catch {
      return false;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <header className="flex items-center gap-2 py-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-semibold text-white">Stepup</h1>
        </header>
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">
            {event.emoji ?? "🏃"} {event.title}
          </h1>
          <p className="truncate text-[11px] text-slate-500">
            {fmtDate(event.startDate)} – {fmtDate(event.endDate)} · day{" "}
            {daysElapsed}/{days.length}
          </p>
        </div>
        <Link
          to={`/steps/${id}/leaderboard`}
          aria-label="Leaderboard"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 active:bg-amber-500/30"
        >
          <Trophy size={16} />
        </Link>
      </header>

      {/* Today + goal ring */}
      <section className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Today
            </p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums text-white">
              {todaySteps.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Goal {goal.toLocaleString()} ·{" "}
              <span
                className={clsx(
                  "font-semibold",
                  goalProgress >= 100
                    ? "text-emerald-300"
                    : goalProgress >= 60
                      ? "text-amber-300"
                      : "text-red-300"
                )}
              >
                {goalProgress}%
              </span>
            </p>
          </div>
          <GoalRing pct={goalProgress} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini value={totalSteps} label="total" icon={Activity} />
          <Mini value={daysGoalMet} label="met" icon={Check} tint="emerald" />
          <Mini
            value={daysElapsed - daysGoalMet}
            label="missed"
            icon={X}
            tint="red"
          />
        </div>
      </section>

      <MyChallengeMobile eventId={event.announcementId} token={token} />

      {/* Sync action */}
      <section className="mb-3 space-y-2">
        {healthAvailable ? (
          <button
            type="button"
            onClick={() => doSync(true)}
            disabled={syncing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Heart size={14} className="fill-current" />
            )}
            Sync from Apple Health
          </button>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2.5 text-[11px] text-slate-400">
            <Heart size={14} className="mt-0.5 flex-shrink-0 text-slate-500" />
            <p>
              Apple Health isn't available on this device. Tap any day below to
              enter steps manually.
            </p>
          </div>
        )}
        {syncMsg && (
          <p
            className={clsx(
              "rounded-lg border px-3 py-1.5 text-[11px]",
              syncMsg.startsWith("Synced") || syncMsg === "Up to date."
                ? "border-emerald-700/40 bg-emerald-900/20 text-emerald-200"
                : "border-amber-700/40 bg-amber-900/20 text-amber-200"
            )}
          >
            {syncMsg}
          </p>
        )}
      </section>

      {/* Daily grid */}
      <section className="mb-3">
        <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Calendar size={11} /> Daily progress
        </h2>
        <div className="space-y-1">
          {days.map((d) => {
            const steps = myDailyMap.get(d.iso) ?? 0;
            const met = goal > 0 && steps >= goal;
            const isEditing = editingDate === d.iso;
            return (
              <div
                key={d.iso}
                className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  d.isToday
                    ? "border-indigo-500/60 bg-indigo-500/10"
                    : d.isPast
                      ? met
                        ? "border-emerald-700/40 bg-slate-800/60"
                        : steps > 0
                          ? "border-amber-700/40 bg-slate-800/60"
                          : "border-slate-700 bg-slate-800/40"
                      : "border-slate-700 bg-slate-800/30"
                )}
              >
                <div className="w-16 flex-shrink-0">
                  <p className="text-[11px] font-semibold text-white">
                    {fmtShortDate(d.date)}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">
                    {d.isToday ? "today" : d.isPast ? "" : "upcoming"}
                  </p>
                </div>
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      autoFocus
                      placeholder="steps"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const n = parseInt(editValue, 10);
                        if (await saveManualSteps(d.iso, Number.isFinite(n) ? n : 0)) {
                          setEditingDate(null);
                          setEditValue("");
                        }
                      }}
                      className="rounded-md bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDate(null);
                        setEditValue("");
                      }}
                      className="rounded-md bg-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          "text-sm font-bold tabular-nums",
                          steps === 0
                            ? "text-slate-500"
                            : met
                              ? "text-emerald-300"
                              : "text-white"
                        )}
                      >
                        {steps > 0 ? steps.toLocaleString() : "—"}
                      </p>
                      {goal > 0 && (
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-900">
                          <div
                            className={clsx(
                              "h-full",
                              met
                                ? "bg-emerald-500"
                                : steps > 0
                                  ? "bg-amber-500"
                                  : "bg-slate-700"
                            )}
                            style={{
                              width: `${
                                goal > 0
                                  ? Math.min(100, (steps / goal) * 100)
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {(d.isPast || d.isToday) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDate(d.iso);
                          setEditValue(String(steps || ""));
                        }}
                        aria-label="Edit"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 active:bg-slate-700 active:text-slate-200"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Helper foot */}
      <section className="mb-4 flex items-start gap-2 text-[10px] text-slate-500">
        <RefreshCw size={11} className="mt-0.5 flex-shrink-0" />
        <p>
          Sync runs automatically when you open the app (max once every 15 min).
          Tap Sync above to force a refresh. Manual entries override Health
          values for that day.
        </p>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Mini({
  value,
  label,
  icon: Icon,
  tint = "slate",
}: {
  value: number;
  label: string;
  icon: typeof Activity;
  tint?: "slate" | "emerald" | "red";
}) {
  const color =
    tint === "emerald"
      ? "text-emerald-300"
      : tint === "red"
        ? "text-red-300"
        : "text-white";
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 py-2">
      <Icon size={11} className={clsx("mx-auto mb-0.5", color)} />
      <p className={clsx("text-sm font-bold tabular-nums", color)}>
        {value.toLocaleString()}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function GoalRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  const color =
    pct >= 100
      ? "stroke-emerald-400"
      : pct >= 60
        ? "stroke-amber-400"
        : "stroke-indigo-400";
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0">
      <circle cx="32" cy="32" r={r} className="stroke-slate-700" strokeWidth="6" fill="none" />
      <circle
        cx="32"
        cy="32"
        r={r}
        className={clsx(color, "transition-all")}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="36"
        textAnchor="middle"
        className="fill-white text-[12px] font-bold tabular-nums"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
  });
}

function messageFor(reason: string): string {
  if (reason === "denied")
    return "Apple Health access denied. Enable it in Settings → Privacy → Health → OneRMV.";
  if (reason === "throttled") return "Just synced — try again in 15 min.";
  if (reason === "none") return "No new step data from Apple Health.";
  if (reason === "web")
    return "Sync only works on the iPhone app, not the web.";
  return "Could not sync. Tap to retry.";
}

