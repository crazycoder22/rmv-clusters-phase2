import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Heart,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import {
  isHealthKitAvailable,
  readStepsByDay,
  requestHealthAuth,
  type DailyStepBucket,
} from "../lib/healthkit";

// "My steps" — a personal HealthKit view that works independently of any
// Stepup challenge. Useful when residents just want to see their own daily
// activity. No server I/O — purely reads HealthKit and renders locally.

const WINDOW_DAYS = 30;

export default function MySteps() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [buckets, setBuckets] = useState<DailyStepBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Discover whether HealthKit can be used at all. On web / Android this is
  // false and we'll render the "not available" state.
  useEffect(() => {
    void isHealthKitAvailable().then(setAvailable);
  }, []);

  const load = useCallback(
    async (askPermission: boolean) => {
      if (available === false) return;
      setLoading(true);
      setError(null);
      try {
        if (askPermission) {
          setPermissionAsked(true);
          // iOS often returns granted=true even when the user denied
          // (privacy quirk). We ignore the boolean — the real signal is
          // whether readStepsByDay returns data below.
          await requestHealthAuth();
        }
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (WINDOW_DAYS - 1));
        start.setHours(0, 0, 0, 0);
        const data = await readStepsByDay(start.toISOString(), end.toISOString());
        setBuckets(data);
        setLastSyncAt(new Date());
        // If buckets came back empty AFTER asking permission, that's the
        // real "denied" signal — surface a friendlier hint.
        if (data.length === 0 && askPermission) {
          setError(
            "No step data returned. Open Settings → Privacy → Health → OneRMV to confirm 'Steps' is allowed."
          );
        }
      } catch {
        setError("Could not read step data.");
      } finally {
        setLoading(false);
      }
    },
    [available]
  );

  // Auto-load on mount if HealthKit is available. We don't preemptively
  // ask for permission — let the user tap the big button so the system
  // prompt feels intentional.
  useEffect(() => {
    if (available === true && !permissionAsked) {
      // Try reading first — if permission was previously granted (e.g.
      // through a Stepup event), data will appear without prompting.
      void load(false);
    }
  }, [available, permissionAsked, load]);

  // ── Derived metrics ─────────────────────────────────────────────────────

  const todayIsoStr = todayIso();
  const today = useMemo(
    () => buckets.find((b) => b.date === todayIsoStr)?.steps ?? 0,
    [buckets, todayIsoStr]
  );

  const last7Days = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    return buckets.filter((b) => new Date(b.date) >= cutoff);
  }, [buckets]);

  const week = useMemo(() => {
    const total = last7Days.reduce((s, b) => s + b.steps, 0);
    const activeDays = last7Days.filter((b) => b.steps > 0).length;
    return {
      total,
      activeDays,
      avg: activeDays > 0 ? Math.round(total / activeDays) : 0,
      best: last7Days.reduce(
        (best, b) => (b.steps > best.steps ? b : best),
        { date: "", steps: 0 }
      ),
    };
  }, [last7Days]);

  // Build a complete 30-day window with zeros for missing days, newest first.
  const dayRows = useMemo(() => {
    const map = new Map(buckets.map((b) => [b.date, b.steps]));
    const rows: { iso: string; steps: number }[] = [];
    const today = new Date();
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      rows.push({ iso, steps: map.get(iso) ?? 0 });
    }
    return rows;
  }, [buckets]);

  const maxStepsInWindow = Math.max(...dayRows.map((d) => d.steps), 1);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">My steps</h1>
          <p className="truncate text-[11px] text-slate-500">
            From Apple Health · last {WINDOW_DAYS} days
          </p>
        </div>
        {available === true && buckets.length > 0 && (
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        )}
      </header>

      {/* HealthKit unavailable (web or non-iOS) */}
      {available === false && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-6 text-center">
          <Heart size={28} className="mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-300">
            Apple Health isn't available on this device.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Install OneRMV on iPhone to see your steps here.
          </p>
        </div>
      )}

      {/* HealthKit available but no data yet (permission likely denied) */}
      {available === true && !loading && buckets.length === 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-6 text-center">
          <Heart size={28} className="mx-auto mb-2 text-pink-400" />
          <p className="text-sm font-semibold text-white">
            Connect Apple Health
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            OneRMV can show your step count from Apple Health. We never share
            it outside the community server.
          </p>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Heart size={14} className="fill-current" />
            )}
            Allow access
          </button>
          {error && (
            <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-1.5 text-[11px] text-amber-200">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Data view */}
      {available === true && buckets.length > 0 && (
        <>
          {/* Today hero */}
          <section className="mb-3 rounded-2xl border border-slate-700 bg-gradient-to-br from-indigo-500/15 to-emerald-500/15 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Today
            </p>
            <p className="mt-0.5 text-4xl font-bold tabular-nums text-white">
              {today.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              <Activity size={11} className="-mt-0.5 mr-0.5 inline" />
              steps so far
            </p>
          </section>

          {/* Weekly summary */}
          <section className="mb-3 grid grid-cols-3 gap-2">
            <Stat
              value={week.total}
              label="this week"
              icon={Calendar}
            />
            <Stat
              value={week.avg}
              label="avg / active day"
              icon={TrendingUp}
            />
            <Stat
              value={week.best.steps}
              label="best day"
              icon={Activity}
              hint={week.best.date ? fmtShortDate(week.best.date) : ""}
            />
          </section>

          {/* 30-day list with mini bars */}
          <section className="mb-4">
            <h2 className="mb-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Calendar size={11} /> Daily history
            </h2>
            <div className="space-y-0.5">
              {dayRows.map((d, i) => {
                const isToday = d.iso === todayIsoStr;
                const widthPct = (d.steps / maxStepsInWindow) * 100;
                return (
                  <div
                    key={d.iso}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5",
                      isToday
                        ? "bg-indigo-500/15"
                        : i % 2 === 0
                          ? "bg-slate-800/40"
                          : "bg-slate-800/20"
                    )}
                  >
                    <div className="w-16 flex-shrink-0">
                      <p className="text-[11px] font-medium text-slate-200">
                        {isToday ? "Today" : fmtShortDate(d.iso)}
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-900">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            d.steps === 0
                              ? "bg-slate-700"
                              : isToday
                                ? "bg-indigo-400"
                                : d.steps >= 10000
                                  ? "bg-emerald-500"
                                  : d.steps >= 5000
                                    ? "bg-amber-500"
                                    : "bg-slate-500"
                          )}
                          style={{ width: `${Math.max(2, widthPct)}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={clsx(
                        "w-16 flex-shrink-0 text-right text-[11px] font-mono tabular-nums",
                        d.steps === 0 ? "text-slate-600" : "text-white"
                      )}
                    >
                      {d.steps > 0 ? d.steps.toLocaleString() : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer note */}
          <p className="pb-4 text-center text-[10px] text-slate-500">
            {lastSyncAt && (
              <>
                Updated {lastSyncAt.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {" · "}
              </>
            )}
            Data from Apple Health (includes iPhone + Apple Watch)
          </p>
        </>
      )}

      {/* Spinner while initial load is in flight */}
      {available === null && (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({
  value,
  label,
  icon: Icon,
  hint,
}: {
  value: number;
  label: string;
  icon: typeof Activity;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
      <Icon size={11} className="mb-0.5 text-slate-400" />
      <p className="text-base font-bold leading-tight tabular-nums text-white">
        {value.toLocaleString()}
      </p>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {hint && (
        <p className="mt-0.5 text-[9px] text-slate-500">{hint}</p>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayIso(): string {
  return isoDate(new Date());
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
